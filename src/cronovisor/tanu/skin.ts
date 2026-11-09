// The skin Tanu wears, painted in the language of Selk'nam body paint: black, white and red (Eze's reference,
// 2026-11-08: a humpback painted with long white lines and rows of red dots). On the whale: a dark, washed grey-black
// body; white lines running head to tail along the flanks, as if drawn with a finger; rows of red dots between them;
// a pale grooved throat; small white knobs on the head and along the fins' leading edge; red bands across the fins.
// Unlit on purpose, with a faint rim so she reads against the sky. Kept under the bloom threshold.
import * as THREE from 'three';

export const SKIN_VERT = /* glsl */`
  attribute float aS, aKind, aT, aSide, aC;
  uniform float uPhase, uAmp, uFin, uBreath, uTurn, uPitch, uHover;
  uniform vec3 uFinRoot; // the right fin's hinge (the left one mirrors it)
  uniform float uFlukeS; // where the flukes begin (1 on the procedural body, earlier on the sculpted one)
  uniform float uFinRest; // how the fins are held at rest: out a little (procedural), or let down from the sculpture's outstretched pose
  varying vec3 vRest, vNormal, vView;
  varying vec2 vUv;
  varying float vS, vKind, vT, vC;
  vec3 rotX(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, v.y*c - v.z*s, v.y*s + v.z*c); }
  vec3 rotZ(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x*c - v.y*s, v.x*s + v.y*c, v.z); }
  // the spine, seen from the side: a wave from head to tail, small at the head and growing past the chest, plus the
  // whole torso rocking on a pivot at the chest (the head dips as the tail rises)
  float spineY(float s){
    float A = uAmp*(.01 + .12*pow(smoothstep(.22, 1.06, s), 1.5));
    // pitching up or down, the body bows into it: head and tail towards the new course, the middle behind
    return A*sin(uPhase - s*4.4) + uAmp*.022*sin(uPhase + 1.3)*(.42 - s) + uPitch*.2*((s - .45)*(s - .45) - .07);
  }
  // and from above: in a turn the body bends into a bow, head and tail towards the inside
  float spineX(float s){ return -uTurn*.26*((s - .45)*(s - .45) - .07); }
  void main(){
    vec3 p = position, n = normal;
    vRest = position; vS = aS; vKind = aKind; vT = aT; vC = aC; vUv = uv;
    float s = aS, zs = .5 - s;
    // breathing: the body swells and settles along its normals, most at the chest
    // (the chest only: the head stays still, so the eyes and their sockets never part)
    if(aKind < .5) p += n*uBreath*.006*smoothstep(.29, .37, s)*(1. - smoothstep(.5, .8, s));
    // the long pectoral fins row from their hinge, a little behind each stroke, the tip lagging the root so the
    // fin bends like a flexible wing; hovering she sculls with them to hold her place; turning, the outside one
    // lifts; climbing or diving, both tilt like elevators
    if(aKind > .5 && aKind < 1.5){
      vec3 root = vec3(uFinRoot.x*aSide, uFinRoot.y, uFinRoot.z);
      float hinge = smoothstep(0., .18, aT); // the fin's root stays with the body
      float lag = aT*1.3;                     // how far behind the root the tip moves
      float sweep = (.22*(.4 + .6*uAmp) + .12*uHover)*sin(uPhase - 1.1 - lag + aSide*.25)*hinge*(1. + .5*aT);
      float spread = aSide*(uFinRest + (.09 + .1*uHover)*sin(uFin + aSide*.4 - lag*.7) + aSide*uTurn*.25 + uPitch*.18)*hinge;
      vec3 q = rotZ(rotX(p - root, sweep), spread);
      n = rotZ(rotX(n, sweep), spread);
      p = root + q;
    }
    // the flukes: they pitch with the beat, the tips lagging behind the middle
    if(aKind > 1.5 && aKind < 2.5){
      p.y += (s - uFlukeS)*(uFlukeS < .99 ? .12 : .3)*uAmp*cos(uPhase - s*4.4);
      p.y += abs(p.x)*abs(p.x)*.55*uAmp*cos(uPhase - 5.2);
    }
    // bend every cross-section with the spine: it follows the curve and turns with it, so the tail arches
    float e = .01;
    float Y = spineY(s), X = spineX(s);
    float dY = (spineY(s + e) - spineY(s - e))/(2.*e), dX = (spineX(s + e) - spineX(s - e))/(2.*e);
    float a = atan(dY), b = atan(dX);
    vec2 yz = vec2(p.y, p.z - zs);
    yz = vec2(yz.x*cos(a) - yz.y*sin(a), yz.x*sin(a) + yz.y*cos(a));
    vec2 ny = vec2(n.y*cos(a) - n.z*sin(a), n.y*sin(a) + n.z*cos(a));
    p.y = yz.x + Y; p.z = yz.y + zs;
    n.y = ny.x; n.z = ny.y;
    vec2 xz = vec2(p.x, p.z - zs);
    xz = vec2(xz.x*cos(b) - xz.y*sin(b), xz.x*sin(b) + xz.y*cos(b));
    vec2 nx = vec2(n.x*cos(b) - n.z*sin(b), n.x*sin(b) + n.z*cos(b));
    p.x = xz.x + X; p.z = xz.y + zs;
    n.x = nx.x; n.z = nx.y;
    vec4 mv = modelViewMatrix*vec4(p, 1.);
    vView = -mv.xyz;
    vNormal = normalize(normalMatrix*n);
    gl_Position = projectionMatrix*mv;
  }`;

export const SKIN_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime, uEyeLight, uOpacity, uHasNormalMap, uEyeR, uBlink;
  uniform vec3 uEye;
  uniform sampler2D uNormalMap;
  varying vec3 vRest, vNormal, vView;
  varying vec2 vUv;
  varying float vS, vKind, vT, vC;
  const vec3 WHITE = vec3(.74, .72, .68);
  const vec3 RED = vec3(.72, .1, .08);
  float hash1(float n){ return fract(sin(n*127.1)*43758.5453); }
  float noise(vec3 p){ // value noise, for the wash of the paint
    vec3 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
    float n = i.x + i.y*57. + i.z*113.;
    return mix(mix(mix(hash1(n), hash1(n + 1.), f.x), mix(hash1(n + 57.), hash1(n + 58.), f.x), f.y),
               mix(mix(hash1(n + 113.), hash1(n + 114.), f.x), mix(hash1(n + 170.), hash1(n + 171.), f.x), f.y), f.z);
  }
  // a painted line: soft-edged, its width breathing along the stroke
  float stroke(float d, float w, float aa){ return 1. - smoothstep(w - aa, w + aa, abs(d)); }
  // the sculpture's relief from its normal map, with no tangents needed (the way three.js does it from derivatives)
  vec3 relief(vec3 N){
    vec3 mapN = texture2D(uNormalMap, vUv).xyz*2. - 1.;
    vec3 q0 = dFdx(-vView), q1 = dFdy(-vView);
    vec2 st0 = dFdx(vUv), st1 = dFdy(vUv);
    vec3 q1perp = cross(q1, N), q0perp = cross(N, q0);
    vec3 T = q1perp*st0.x + q0perp*st1.x, B = q1perp*st0.y + q0perp*st1.y;
    float det = max(dot(T, T), dot(B, B));
    float k = det == 0. ? 0. : inversesqrt(det);
    return normalize(T*(mapN.x*k) + B*(mapN.y*k) + N*mapN.z);
  }
  void main(){
    vec3 N = normalize(vNormal), V = normalize(vView);
    if(!gl_FrontFacing) N = -N;
    // her eye (the cap that closes the sculpture's socket): light, so it reads from afar on the dark head (Eze:
    // so the blink shows), a warm ivory round an amber-brown iris and a dark pupil, wet with a catchlight (kept
    // under the bloom threshold). Blinking, a dark lid the colour of her skin comes down from above and lifts.
    if(vKind > 2.5){
      float d = 1. - vC;                                   // 0 at the centre, 1 at the rim
      vec3 eyeCol = vec3(.66, .62, .55);                   // ivory
      eyeCol = mix(eyeCol, vec3(.38, .22, .1), 1. - smoothstep(.5, .6, d));   // the iris
      eyeCol = mix(eyeCol, vec3(.02, .015, .012), 1. - smoothstep(.2, .28, d)); // the pupil
      eyeCol *= .75 + .35*max(0., dot(N, V));
      float spec = pow(max(0., dot(N, normalize(V + vec3(.35, .7, .2)))), 70.);
      eyeCol += vec3(1., .97, .92)*spec*.6;
      // the lid: its edge sweeps from above the eye (blink 0) to below it (blink 1)
      float up = (vRest.y - uEye.y)/max(uEyeR, 1e-4);
      float edge = 1.15 - 2.3*uBlink;
      eyeCol = mix(eyeCol, vec3(.04, .036, .038), smoothstep(edge - .12, edge + .12, up));
      gl_FragColor = vec4(eyeCol, uOpacity);
      return;
    }
    if(uHasNormalMap > .5) N = relief(N);
    float facing = abs(dot(N, V));
    // a soft light from above and to one side, so the relief reads (never strong enough to bloom)
    float lit = .62 + .58*max(0., dot(N, normalize(vec3(-.35, .8, .45))));
    // the body: grey-black, washed like ink on wet paper, a little lighter where it faces up
    float wash = noise(vRest*38.)*.6 + noise(vRest*95.)*.4;
    vec3 col = vec3(.05, .05, .055)*(.65 + .7*wash)*(.75 + .5*clamp(N.y*.5 + .5, 0., 1.))*lit;
    col += vec3(.5, .52, .58)*pow(1. - facing, 3.)*.4; // the rim: her outline against the sky
    float paint = 0.; vec3 pcol = WHITE;
    if(vKind < .5){
      float th = abs(atan(vRest.x, vRest.y));      // 0 on the back, pi under the belly
      float rad = length(vRest.xy) + 1e-4;
      float arc = th*rad;                           // distance round the body from the spine, in body lengths
      float aa = fwidth(arc)*1.2 + 1e-4;
      // long white lines down the flank, head to tail, drawn by hand (each wavers, swells and thins)
      for(int k = 0; k < 4; k++){
        float fk = float(k);
        float at = (1.18 + fk*.36)*rad + .0035*sin(vS*31. + fk*2.3);
        float from = .05 + fk*.035, to = .93 - fk*.07;
        float reach = smoothstep(from, from + .05, vS)*smoothstep(to, to - .1, vS);
        float w = (.0042 + .0016*sin(vS*17. + fk))*(k == 0 ? 1.15 : 1.);
        paint = max(paint, stroke(arc - at, w, aa)*reach);
      }
      col = mix(col, WHITE*(.55 + .45*facing)*(.85 + .3*wash)*lit, paint);
      // rows of red dots between the lines, staggered
      for(int k = 0; k < 3; k++){
        float fk = float(k);
        float at = (1.36 + fk*.36)*rad;
        float step_ = .046, off = mod(fk, 2.)*.5;
        float cellS = (floor(vS/step_ - off) + .5 + off)*step_;
        float reach = smoothstep(.1 + fk*.03, .15 + fk*.03, cellS)*smoothstep(.8 - fk*.09, .74 - fk*.09, cellS);
        float d = length(vec2((vS - cellS)*1., arc - at));
        float r = .0074*(.85 + .3*hash1(cellS*91. + fk));
        float dot_ = (1. - smoothstep(r - aa, r + aa, d))*reach;
        col = mix(col, RED*(.6 + .4*facing)*(.85 + .3*wash)*lit, dot_);
      }
      // the throat: pale, with its long grooves from chin to navel
      if(th > 2.35){
        float g = abs(fract(arc*95.) - .5);
        float throat = smoothstep(2.35, 2.6, th)*smoothstep(.5, .3, vS)*smoothstep(0., .05, vS);
        col = mix(col, WHITE*(.35 + .45*facing)*(1. - .55*(1. - smoothstep(.08, .22, g))), throat*.75);
      }
      // white knobs on the head, as a humpback's
      if(vS < .16 && th < 1.3){
        vec3 c = vRest*vec3(70., 70., 52.), cell = floor(c);
        float h = hash1(dot(cell, vec3(1., 57., 113.)));
        float d = length(c - cell - .5);
        col = mix(col, WHITE, step(.72, h)*(1. - smoothstep(.16, .26, d))*.9);
      }
    } else if(vKind < 1.5){
      // the long fins: dark, two red bands across near the tip, white knobs along the leading edge
      float aa = fwidth(vT)*1.2 + 1e-4;
      float bands = max(stroke(vT - .66, .035, aa), stroke(vT - .8, .03, aa));
      col = mix(col, RED*(.6 + .4*facing), bands);
      // round white knobs on the leading edge, one on each bump of it
      float ph = (vT - .2)*6.5;
      float kd = length(vec2((fract(ph) - .5)*.85, (vC - .95)*3.2));
      col = mix(col, WHITE*(.6 + .4*facing), (1. - smoothstep(.13, .18, kd))*step(.2, vT)*step(vT, .97));
    }
    // round her eye the paint gives way to a dark patch (on the procedural body, with no eye of its own, a calm
    // pale light)
    vec3 e = vec3(abs(vRest.x), vRest.y, vRest.z);
    float de = length(e - uEye);
    // (no ring of its own: the socket is almond-shaped, and the eye shows that shape itself)
    if(uEyeR > 0.){
      col = mix(col, vec3(.03, .028, .03)*lit, 1. - smoothstep(uEyeR*1.05, uEyeR*1.7, de));
    } else col += vec3(.95, .92, .82)*(1. - smoothstep(.005, .009, de))*uEyeLight*.8;
    gl_FragColor = vec4(col, uOpacity);
  }`;

export function makeSkin(){
  const uniforms = {
    uTime: { value: 0 }, uPhase: { value: 0 }, uAmp: { value: .5 }, uFin: { value: 0 }, uBreath: { value: 0 }, uTurn: { value: 0 },
    uEyeLight: { value: 1 }, uEye: { value: new THREE.Vector3() }, uOpacity: { value: 1 }, uFinRoot: { value: new THREE.Vector3() }, uFlukeS: { value: 1 }, uFinRest: { value: .1 }, uEyeR: { value: 0 }, uBlink: { value: 0 }, uPitch: { value: 0 }, uHover: { value: 0 }, uHasNormalMap: { value: 0 }, uNormalMap: { value: null as THREE.Texture | null },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: SKIN_VERT, fragmentShader: SKIN_FRAG, uniforms, side: THREE.DoubleSide });
  return { mat, uniforms };
}
