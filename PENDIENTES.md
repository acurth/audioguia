# Pendientes — audioguia.io

Lista de trabajo abierto. Creada el 2026-09-27.
Marcá `[x]` al terminar y anotá la fecha. Si una idea nueva se parece a una que ya está, se suma a esa en lugar de abrir otra.

Quién: **Axel** o **Claude**. "Specs" quiere decir que Axel pasa los detalles antes de empezar.

## Esta semana

- [ ] **Sendero nuevo** — Axel ya tiene fotos, puntos e ideas para los audios.
  - [ ] Axel: grabar los audios propios y conseguir quien grabe los otros.
  - [ ] Claude: armar el JSON del sendero y sus archivos cuando Axel pase el material.

- [ ] **1. Offline real: que la app arranque sin conexión** — Claude.
  - Hoy el service worker no guarda las páginas HTML (usa `build` y `files`, falta `prerendered`), así que la app del teléfono no abre sin red.
  - Guardar las páginas junto con la app.
  - Páginas y archivos de la app: primero la red, después lo guardado. Así un cambio siempre llega al teléfono (hoy usa siempre lo guardado y nunca actualiza).
  - Audios y fotos de los senderos: primero lo guardado, como ahora.
  - Explorar sin conexión: aviso de que solo están los senderos descargados.
  - Prueba (Axel): en el iPhone, descargar el sendero **desde adentro de la app de la pantalla de inicio** (puede tener almacenamiento separado del de Safari), poner modo avión, cerrar la app y abrirla de cero.

- [ ] **2. Mini player: ajustes** — specs de Axel.
- [ ] **3. Botón "Detener recorrido": ajustes** — specs de Axel.

- [ ] **4. Varias fotos y videos cortos por punto** — Claude.
  - Por defecto sigue siendo 1 foto, y con 1 sola se ve igual que hoy.
  - Con más de una, el ícono muestra cuántas fotos y videos hay.
  - Máximo 2 o 3 por punto. Todo entra en la descarga offline (`scripts/build-manifests.mjs`).
  - Toca `PointPhoto.svelte`, `PhotoViewer.svelte` y el formato del JSON del sendero.

- [ ] **5. Página Cuenta: implementar el diseño que ya existe** — specs de Axel.
  - Es la parte de Cuenta de la fase 8 del rediseño (`audioguia-rediseno`).

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
