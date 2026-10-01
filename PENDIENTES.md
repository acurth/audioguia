# Pendientes — audioguia.io

Lista de trabajo abierto. Creada el 2026-09-27.
Marcá `[x]` al terminar y anotá la fecha. Si una idea nueva se parece a una que ya está, se suma a esa en lugar de abrir otra.

Quién: **Axel** o **Claude**. "Specs" quiere decir que Axel pasa los detalles antes de empezar.

## Esta semana

- [ ] **Sendero nuevo** — Axel ya tiene fotos, puntos e ideas para los audios.
  - [ ] Axel: grabar los audios propios y conseguir quien grabe los otros.
  - [ ] Claude: armar el JSON del sendero y sus archivos cuando Axel pase el material.

- [x] **1. Offline real: que la app arranque sin conexión** — Claude. Axel lo probó en el iPhone: listo el 2026-09-30.
  - Hoy el service worker no guarda las páginas HTML (usa `build` y `files`, falta `prerendered`), así que la app del teléfono no abre sin red.
  - Guardar las páginas junto con la app.
  - Páginas y archivos de la app: primero la red, después lo guardado. Así un cambio siempre llega al teléfono (hoy usa siempre lo guardado y nunca actualiza).
  - Audios y fotos de los senderos: primero lo guardado, como ahora.
  - Explorar sin conexión: aviso de que solo están los senderos descargados.
  - 2026-09-29: hecho en el código y probado en Chrome con el servidor apagado (todas las páginas abren y la navegación funciona). Publicado el 2026-09-29 (run 36655541485). Falta la prueba en el iPhone.
  - Prueba (Axel): en el iPhone, descargar el sendero **desde adentro de la app de la pantalla de inicio** (puede tener almacenamiento separado del de Safari), poner modo avión, cerrar la app y abrirla de cero.

- [x] **2. Mini player: ajustes** — specs de Axel. Axel lo revisó: listo el 2026-09-30.
  - 2026-09-29: hecho en el código. Play antes que Detener; segunda línea "En recorrido" y el tiempo total; tercera línea "Audio N de 10", barra de progreso y duración del audio. En Detalle, el sendero que está en curso muestra "Recorrido en curso" en lugar de "Iniciar recorrido · N puntos". Falta que Axel lo revise en el teléfono.
- [x] **3. Botón "Detener recorrido": ajustes** — specs de Axel. Axel lo revisó: listo el 2026-09-30.
  - 2026-09-29: hecho en el código. A la izquierda el tiempo del recorrido; a la derecha "Detener recorrido" y el botón con el mismo tamaño que el play del audio, en celeste claro. Falta que Axel lo revise en el teléfono y en el iPad.

- [x] **4. Varias fotos y videos cortos por punto** — Claude. Listo el 2026-09-30.
  - Por defecto sigue siendo 1 foto, y con 1 sola se ve igual que hoy.
  - Con más de una, el ícono muestra cuántas fotos y videos hay.
  - Máximo 2 o 3 por punto. Todo entra en la descarga offline (`scripts/build-manifests.mjs`).
  - Toca `PointPhoto.svelte`, `PhotoViewer.svelte` y el formato del JSON del sendero.
  - 2026-09-30: hecho en el código (`MediaStrip.svelte`). Los videos van en la misma lista `photos` del JSON (`.mp4`), en el orden en que se ven. Con el dedo se desliza; con mouse hay flechas y dan la vuelta. Puntos abajo indican cuántos hay (el video es un triángulo). Los videos arrancan solos, sin sonido y en loop. La primera foto fija el tamaño de la postal. Falta que Axel lo pruebe en el iPhone y el iPad.
  - 2026-09-30: Axel lo probó en el iPhone y el iPad. Se sacaron las fotos y el video de prueba.

- [x] **5. Página Cuenta: implementar el diseño que ya existe** — specs de Axel. Axel lo probó: listo el 2026-09-30.
  - Es la parte de Cuenta de la fase 8 del rediseño (`audioguia-rediseno`).
  - 2026-09-30: hecho en el código. Banner "Estás como invitado" con "Iniciar sesión (pronto)" apagado; sección "El proyecto" con Sobre la audioguía, Compartir la app, Para editores y Contacto, que se abren en la misma página. El formulario tiene "Motivo" (llega en el asunto y en el cuerpo del email) y una suma simple. `/sobre` y `/contacto` siguen funcionando con el mismo contenido. Falta probar el formulario después de publicar (el servidor de desarrollo no corre PHP).

- [x] **Distancia y brújula sobre el mapa** (handoff de Claude Design "Distancias sobre el mapa", opción D) — Claude.
  - 2026-09-30: hecho en el código (`DistanceHud.svelte`, `stores/compass.ts`). Más chico que el diseño a pedido de Axel: 156 × 46 px como máximo, no tapa ningún número de los tres senderos publicados en teléfono ni iPad. Declinación +5,5° (NOAA, 2026-09-30). La brújula se activa solo al tocar el recuadro ("Tocá para la brújula"); "Iniciar recorrido" pide únicamente la ubicación. Axel lo probó en el iPhone: listo el 2026-09-30.
  - Claude: cuando llegue el sendero nuevo, revisar que ningún número quede debajo del recuadro.

## Para planear (sin fecha)

- [ ] **6. Activar la Cuenta de verdad** — Axel y Claude.
  - Definir tech stack y cómo puede crecer el proyecto.
  - Es el "login" de la fase 8 del rediseño. Hoy "Iniciar sesión" está deshabilitado como "Próximamente".
  - Hoy no hay backend, salvo el PHP del formulario de contacto en DreamHost.

- [ ] **7. Editor en el campo** — Axel y Claude.
  - Crear un sendero mientras se camina, probablemente sin conexión: registrar puntos, fotos, videos y audios offline y subirlos después.
  - Es el "editor" de la fase 8 del rediseño. La reproducción manual de puntos va solo acá (decisión de Axel: no en la app pública).
  - Depende del punto 6 (hace falta una cuenta para subir).

- [ ] **8. Estadísticas anónimas y feedback** — Axel y Claude.
  - Ver quién usa los senderos: inicios, recorridos completados, uso.
  - Anónimo. Al terminar un recorrido, invitar a dejar feedback.
  - Necesita un lugar donde guardar los datos: conviene decidirlo junto con el punto 6.

## Ya estaba pendiente

- [ ] **Mapa base del IGN** en lugar del SVG dibujado (fase 6 del rediseño). Espera imágenes con licencia.
- [ ] **Tablet en vertical** (fase 7 del rediseño).
- [ ] **Páginas que no existen devuelven la home con 200** (soft 404). Prioridad baja.
- [ ] Axel, opcional: en Cloudflare, poner Browser Cache TTL en "Respect existing headers".
- [ ] Axel, fines de diciembre de 2026: borrar las carpetas `bariloche.tv/audioguia/` y `bariloche.tv/audioguia2/`.
