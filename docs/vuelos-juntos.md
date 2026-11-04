# Vuelos juntos: globos compartidos y voz en el Cronovisor

Roadmap, 2026-11-04. Idea de Eze: volar con su hermano (y la familia) en el mismo universo, ver los dos globos juntos y hablar por el micrófono.

## Decisiones tomadas

- **Solo familia**: se ve y se oye solo a quien ya tiene la puerta abierta (el mismo sistema de golpear la puerta: `canEnterSlug`). Nada de visitantes anónimos por ahora.
- **Self-hosted**: todo en el VPS. WebSocket en Node para las posiciones; WebRTC para la voz con **coturn** propio como relevo. Sin servicios de terceros ni cuotas.
- **Micrófono abierto con voz espacial**: la voz sale del globo del otro, se oye clara de cerca, se apaga con la distancia y lejos no se oye. Para hablar hay que acercarse volando. Botón de silencio siempre a mano.
- **Todo pasa volando** (ver la memoria *in-world flows*): sin códigos, links ni salas que crear. Te encontrás con alguien porque está ahí.

## Preguntas abiertas (decidir antes de la etapa que las toca)

1. Cuando alguien no está conectado, ¿no se ve nada, o queda un rastro (la estela de su último vuelo)? → etapa 4.
2. ¿Avisar que Lucho está volando aunque no tengas el sitio abierto (notificación push)? Hoy: no, fuera de alcance.
3. ¿Se ve a los demás también cuando no pilotás (vista general, mirando una pieza)? Propuesta: sí, su globo siempre está; la voz solo mientras pilotás.

---

## Etapa 1 · Verse (globos compartidos) ✅ 2026-11-04

Hecha, salvo el sonido del quemador ajeno (pendiente) y el gancho de desarrollo (se prueba con un WebSocket a mano desde la consola). Decidido al hacerla: solo se ve el globo de quien está pilotando (uno en crucero va pegado a su cámara y saltaría), y el nombre flota sobre la envoltura (debajo se perdía entre las luces).

**Objetivo:** si Lucho vuela en tu galaxia, ves su globo moverse en tiempo real, con su nombre.

### Servidor (`apps/uploader/`)
- [ ] Nuevo `sky.js` con un servidor WebSocket (`ws`, única dependencia nueva) montado sobre el mismo `http.Server` del Express, ruta `/api/sky`.
- [ ] Al conectar, el cliente se presenta: `cv-device` + contraseña de admin si la hay (como `doors`). El servidor resuelve quién es (`ownerOf` / nombre de `whoami` o `cv-name`) y qué galaxias puede pisar.
- [ ] **Salas por galaxia**: el cliente avisa en qué galaxia está (`join <slug>`); solo entra si `canEnterSlug` lo permite. Volver a comprobarlo al cruzar de galaxia y cuando el dueño echa a alguien (`turn away` → se le cierra la conexión).
- [ ] Reenvío simple: el servidor no simula nada, solo pasa los estados de cada uno a los demás de su sala. Límite de tamaño y de frecuencia por conexión (ver si con `express-rate-limit` o un contador propio).
- [ ] Ping/pong cada 20 s; quien se calla 30 s, se va de la sala (`left`).
- [ ] **nginx**: en el bloque de `ezeangeloni.xyz`, `location /api/sky` con `proxy_http_version 1.1`, `Upgrade`/`Connection "upgrade"` y `proxy_read_timeout 3600s`.

### Cliente (`src/pages/index.astro`)
- [ ] `sky`: conexión que se abre solo si este dispositivo puede entrar a alguna galaxia privada o es dueño de una (si no, nada: los visitantes normales no abren ningún socket). Reconexión con espera creciente.
- [ ] Mensaje de estado ~10 por segundo mientras pilotás (2 por segundo quieto): posición en coordenadas **de la galaxia** (no de la escena, que está centrada en la tuya), rumbo, inclinación, quemador, gas, modo (`cruise`/`pilot`/`focus`/`aboard`) y pieza abierta.
- [ ] `others`: un globo por persona, construido con `buildBalloon` en una variante propia (tinte o patrón de gores distinto, para no confundirlo con el tuyo) y **su nombre colgando de la cesta** (`#sky-names`, etiqueta DOM como `#balloon-tag`).
- [ ] Interpolación con un búfer de ~150 ms para que se mueva suave aunque los mensajes lleguen a saltos; si se corta, el globo se queda flotando y se desvanece a los 30 s.
- [ ] Su quemador se ve y se oye (más bajo y con la distancia), y la guirnalda de luces muestra su gas.
- [ ] Rendimiento: los otros globos cuentan como movimiento en `frameBudget()` solo si están en pantalla.
- [ ] Ganchos de desarrollo en `window.__cv` para simular un segundo globo sin otro teléfono.

**Listo cuando:** Eze en el Pixel y Lucho en su teléfono (o dos pestañas en la compu) se ven volar en la misma galaxia, con nombre, sin tirones; un dispositivo sin puerta abierta no ve nada ni abre socket.

Tamaño: **M**.

## Encuentro · el golpe y el menú ✅ 2026-11-04

Pedido por Eze después de la etapa 1. Al tocarse dos globos, un golpe suave (rebote, sonido, luces que parpadean) abre en las dos pantallas un menú con el nombre del otro: **hablar** (chat en el aire, no se guarda) y **dar gas** (un galón por toque, regalo directo, solo si te quedan 2; partículas doradas de cesta a cesta). Decidido: el chat no se guarda, el gas se regala sin aceptar, la expedición es seguir al que guía.

- [x] Canal uno a uno en `sky.js` (`to` → `ev`), sin guardar nada.
- [x] Golpe: rebote (`pilot.knock`), sonido, luces, menú en los dos lados; se cierra al alejarse.
- [x] Hablar (`c`) y dar gas (`g`, ▲, botón `gas` en el táctil).
- [x] **Expedición** (2026-11-04; el cruce juntos entre galaxias falta probarlo con dos personas reales): "vení conmigo" desde el menú; el otro acepta y va en formación detrás del que guía (piloto automático, el stick mira alrededor, el quemador lo suelta); si el que guía cruza a otra galaxia, el otro cruza con él si tiene gas.

## Etapa 2 · Encontrarse

**Objetivo:** si Lucho vuela en otra galaxia, lo encontrás y vas hacia él sin salir del universo.

- [ ] El servidor manda a cada uno la **presencia**: quién está volando y en qué galaxia (solo en galaxias que puede pisar).
- [ ] Marca en el cielo para cada persona (`#sky-marks`, como las de las galaxias): `Lucho · flying`, con flecha al borde de la pantalla si está fuera de vista; en otra galaxia, la marca apunta a esa galaxia.
- [ ] Tocar la marca navega hacia él (reutilizar `voyage`/`goToWorld`: misma lógica de gas, el Sol y el cruce); dentro de la misma galaxia, el piloto automático lo lleva junto a su globo y se detiene a una distancia de charla.
- [ ] Al llegar a su galaxia, el `#arrival` dice también a quién vas a encontrar ("Lucho está volando aquí").
- [ ] Sonido suave cuando alguien de la familia despega (una nota de `NOTES`), si tenés el sitio abierto.

**Listo cuando:** desde la galaxia de Eze ves que Lucho vuela en la suya, tocás su marca y tu globo termina flotando a su lado.

Tamaño: **S–M** (casi todo reutiliza lo que hay).

## Etapa 3 · Hablar (voz espacial)

**Objetivo:** cerca uno del otro, se oyen; lejos, no.

### Servidor
- [ ] **coturn** en el VPS (paquete de Ubuntu), en `3478` UDP/TCP y un rango corto de puertos de relevo (p. ej. `49160–49200` UDP). Abrirlos en `ufw` **y** en el firewall de IONOS. Con `use-auth-secret`: sin usuarios fijos.
- [ ] `GET /api/sky/turn` (solo para quien está en una sala): credenciales TURN temporales (HMAC con el secreto compartido, válidas unas horas).
- [ ] El WebSocket reenvía la señalización WebRTC (offer/answer/ICE) solo entre dos personas de la misma sala.

### Cliente
- [ ] Malla P2P: una conexión WebRTC por persona en la sala (con 2–5 personas sobra; un SFU solo si un día fueran decenas).
- [ ] **Permiso del micrófono dentro del mundo**: la primera vez que otro globo se acerca, aparece junto a él "hablar con Lucho" (tocar, o tecla `v`). Nunca pedir el micrófono al cargar la página.
- [ ] `getUserMedia` con `echoCancellation`, `noiseSuppression` y `autoGainControl`.
- [ ] Voz espacial con Web Audio: la voz de cada uno entra en un `PannerNode` (HRTF) atado a la posición de su globo, relativa a la cámara. Cerca, clara y del lado correcto; se apaga con la distancia y a partir de cierto radio (~120) queda en silencio, aunque la conexión siga abierta.
- [ ] La voz pasa por la misma salida que el resto del sonido, pero **no la silencia `m`** (que es para la música y los efectos); tiene su propio silencio.
- [ ] Botón de micrófono: `#t-mic` en el táctil (junto a los cuatro botones), `v` en el teclado, y una línea en `#pilot-hud`. Indicador de quién está hablando: su envoltura brilla un poco con su voz.
- [ ] Mientras hablan, bajar un poco el ruido del vuelo (*ducking*).

**Listo cuando:** Eze y Lucho, en 4G/5G y sin wifi, se acercan volando y se oyen sin eco; al alejarse, la voz se apaga; con el micrófono silenciado no sale nada.

Tamaño: **M–L** (coturn y las redes móviles son lo delicado).

## Etapa 4 · Momentos compartidos (más adelante, a elegir)

- [ ] **Mirar juntos**: si Lucho abre una pieza, su globo flota frente a ella y su marca dice qué está mirando; podés acercarte y abrir la misma.
- [ ] **Saludarse**: un doble toque al quemador hace un destello que el otro ve y oye.
- [ ] **Palabras en el aire**: las que uno escribe en el globo, el otro las ve caer en directo.
- [ ] **Volar en formación**: "seguir a Lucho" engancha tu globo detrás del suyo.
- [ ] Rastro del último vuelo (pregunta abierta 1).

---

## Riesgos y cosas a vigilar

- **Redes móviles y coturn**: el 4G/5G suele bloquear la conexión directa, así que sin TURN la voz falla justo en el teléfono. Probar desde el principio fuera del wifi de casa.
- **Android en segundo plano**: con la pantalla apagada o en otra app, Chrome puede cortar el audio. Sirve para volar juntos, no como llamada.
- **Eco**: el micrófono abierto sin auriculares puede devolver el sonido del sitio; mitigado por la cancelación del navegador. Recomendar auriculares en la ayuda.
- **Privacidad**: la posición y la voz solo viajan entre personas con la puerta abierta; el servidor no graba nada. Echar a alguien de la galaxia lo saca también del cielo compartido.
- **Batería**: WebGL, más WebSocket, más audio. Mantener la frecuencia de estado baja cuando nada se mueve.

## Orden de trabajo

1 → 2 → 3, probando cada etapa con Lucho antes de pasar a la siguiente. La 4 se elige después de haber volado juntos.
