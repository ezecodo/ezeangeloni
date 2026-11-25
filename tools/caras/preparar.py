"""Prepara las caras para /caras/ (morphing en bucle): recorta, detecta los puntos de cada cara y arma la malla.

Uso (con MediaPipe 0.10.14, que trae el modelo dentro: python3 -m venv v && v/bin/pip install mediapipe==0.10.14 scipy pillow):
  v/bin/python tools/caras/preparar.py <imagen o carpeta> [salida=public/caras]
- Una imagen con varias caras en cuadrícula (separadas por blanco, como las que da Gemini): las recorta.
- Una carpeta con una imagen por cara (lo ideal: >= 1024 px, de frente, misma luz y fondo): las usa en el orden en que
  se guardaron (fecha del archivo), todas al tamaño de la primera, y las alinea: los ojos de todas al mismo lugar y a la
  misma distancia (la media), así en las transiciones la cara no salta.
Escribe cara0.jpg… y morph.json: { w, h, tri (índices), formas (por cara, x y de cada punto en píxeles) }. Cada forma son
los 468 puntos de MediaPipe, dos anillos alrededor de la cara (para que cabeza, pelo y hombros se deformen con ella) y
puntos del borde; los triángulos salen de la forma media (Delaunay), los mismos para todas.
"""
import sys, os, json, glob
import numpy as np, mediapipe as mp
from PIL import Image, ImageDraw, ImageFilter
from scipy.spatial import Delaunay

src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else 'public/caras'
os.makedirs(out, exist_ok=True)

def cuadricula(im):
    a = np.asarray(im).astype(float).mean(axis=2)
    def tramos(perfil):
        dentro = perfil < .9; res = []; i = 0
        while i < len(perfil):
            if dentro[i]:
                j = i
                while j < len(perfil) and dentro[j]: j += 1
                if j - i > 100: res.append((i, j))
                i = j
            else: i += 1
        return res
    cols, filas = tramos((a > 235).mean(axis=0)), tramos((a > 235).mean(axis=1))
    return [im.crop((x0 + 3, y0 + 3, x1 - 3, y1 - 3)) for (y0, y1) in filas for (x0, x1) in cols]

fm = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1)
if os.path.isdir(src):
    archivos = sorted([f for f in glob.glob(os.path.join(src, '*')) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp'))], key=os.path.getmtime)
    caras = [Image.open(f).convert('RGB') for f in archivos]
    caras = [c.resize(caras[0].size, Image.LANCZOS) for c in caras]
    # alinear: el centro de los ojos y su distancia, de cada cara a la media (escala y giro, sin deformar)
    W0, H0 = caras[0].size; ojos = []
    for c in caras:
        r = fm.process(np.asarray(c)); l = r.multi_face_landmarks[0].landmark if r.multi_face_landmarks else None
        ojos.append(None if l is None else (np.array([l[33].x*W0, l[33].y*H0]), np.array([l[263].x*W0, l[263].y*H0])))
    validos = [o for o in ojos if o is not None]
    mi, md = np.mean([o[0] for o in validos], axis=0), np.mean([o[1] for o in validos], axis=0)
    alineadas = []
    for c, o in zip(caras, ojos):
        if o is None: alineadas.append(c); continue
        # la transformación que lleva los ojos de esta cara a los de la media (similitud), invertida para PIL
        a, b = o; va, vb = b - a, md - mi
        s_ = np.linalg.norm(vb)/np.linalg.norm(va); ang = np.arctan2(vb[1], vb[0]) - np.arctan2(va[1], va[0])
        R = s_*np.array([[np.cos(ang), -np.sin(ang)], [np.sin(ang), np.cos(ang)]]); t = mi - R @ a
        Ri = np.linalg.inv(R); ti = -Ri @ t
        # lo que queda fuera de la foto se rellena con el color de su fondo (las esquinas de arriba), no con negro puro
        g = np.asarray(c); fondo = tuple(int(v) for v in np.median(np.vstack([g[:40, :40].reshape(-1, 3), g[:40, -40:].reshape(-1, 3)]), axis=0))
        alineadas.append(c.transform(c.size, Image.AFFINE, (Ri[0,0], Ri[0,1], ti[0], Ri[1,0], Ri[1,1], ti[1]), resample=Image.BICUBIC, fillcolor=fondo))
    caras = alineadas
else:
    caras = cuadricula(Image.open(src).convert('RGB'))
W, H = caras[0].size
oval = list(mp.solutions.face_mesh.FACEMESH_FACE_OVAL); nxt = {a: b for a, b in oval}; orden = [oval[0][0]]
while len(orden) < len(nxt): orden.append(nxt[orden[-1]])
borde = np.array([[0,0],[W/2,0],[W,0],[W,H/2],[W,H],[W/2,H],[0,H],[0,H/2],[0,H/4],[W,H/4],[0,3*H/4],[W,3*H/4],[W/4,0],[3*W/4,0],[W/4,H],[3*W/4,H]], float)
formas, buenas, mascaras = [], [], []
for k, c in enumerate(caras):
    r = fm.process(np.asarray(c))
    if not r.multi_face_landmarks: print('sin cara, se salta:', k); continue
    p = np.array([[q.x * W, q.y * H] for q in r.multi_face_landmarks[0].landmark]); m = p.mean(axis=0)
    anillos = np.clip(np.vstack([m + (p[orden][::2] - m)*s for s in (1.35, 1.75)]), 1, [W - 1, H - 1])
    formas.append(np.vstack([p, anillos, borde])); buenas.append(c)
    # la máscara de la cara, pintada como en postproducción: el contorno del rostro (el óvalo de MediaPipe), algo agrandado
    # para que entre el nacimiento del pelo, difuminado parejo (gaussiano) en todo el borde. Va pegada a la imagen, así
    # que se deforma con el morphing. Se guarda a la mitad de tamaño (es suave, no necesita más).
    ov = p[orden]; ce = ov.mean(axis=0); ov = ce + (ov - ce)*np.array([1.07, 1.1]) + np.array([0, -.02*H])
    mk = Image.new('L', (W, H), 0); ImageDraw.Draw(mk).polygon([tuple(q) for q in ov], fill=255)
    mk = mk.filter(ImageFilter.GaussianBlur(W*.03)).resize((W//2, H//2), Image.LANCZOS)
    mascaras.append(mk)
tri = Delaunay(np.mean(formas, axis=0)).simplices
g0 = np.asarray(buenas[0]); fondo = '#%02x%02x%02x' % tuple(int(v) for v in np.median(g0[:40, :40].reshape(-1, 3), axis=0))
json.dump({'w': W, 'h': H, 'fondo': fondo, 'tri': tri.flatten().tolist(), 'formas': [[round(v, 2) for v in f.flatten().tolist()] for f in formas]},
          open(os.path.join(out, 'morph.json'), 'w'), separators=(',', ':'))
for k, c in enumerate(buenas): c.save(os.path.join(out, f'cara{k}.jpg'), quality=92)
for k, m in enumerate(mascaras): m.save(os.path.join(out, f'cara{k}-m.png'))
print(len(buenas), 'caras', W, 'x', H, '·', len(tri), 'triángulos →', out)

# La portada para la galaxia (obra `caras` en WORKS): la primera cara con su máscara, con transparencia, en el mismo
# encuadre cuadrado que usa la página con ?obra (la caja de los 468 puntos de todas, con margen), así al abrirse la cara
# viva cae justo encima. public/obras/caras/cover.webp, 1000×1000.
todos = np.vstack([f[:468] for f in formas]); x0, y0 = todos.min(axis=0); x1, y1 = todos.max(axis=0)
mx, my = (x1 - x0)*.2, (y1 - y0)*.16; x0, x1, y0, y1 = x0 - mx, x1 + mx, y0 - my, y1 + my
cx, cy, lado = (x0 + x1)/2, (y0 + y1)/2, max(x1 - x0, y1 - y0)
caja = (cx - lado/2, cy - lado/2, cx + lado/2, cy + lado/2)
img = np.asarray(buenas[0]).astype(float)/255
negro = max(int(fondo[i:i+2], 16) for i in (1, 3, 5))/255 + .025
img = np.clip((img - negro)/(1 - negro), 0, 1)
mk = np.asarray(mascaras[0].resize((W, H), Image.LANCZOS)).astype(float)/255; mk = mk*mk*(3 - 2*mk)
rgba = Image.fromarray((np.dstack([img, mk])*255).astype(np.uint8), 'RGBA')
fondo_t = Image.new('RGBA', (int(round(lado)), int(round(lado))), (0, 0, 0, 0))
fondo_t.paste(rgba, (int(round(-caja[0])), int(round(-caja[1]))))
os.makedirs('public/obras/caras', exist_ok=True)
fondo_t.resize((1000, 1000), Image.LANCZOS).save('public/obras/caras/cover.webp', quality=90)
print('portada → public/obras/caras/cover.webp')
