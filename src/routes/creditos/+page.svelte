<script lang="ts">
  import { APP_VERSION, CONTENT_VERSION, LAST_UPDATE } from "$lib/config/version";
  const CURRENT_YEAR = new Date().getFullYear();
</script>

<div class="page">
  <a class="skip-link" href="#main">Saltar al contenido</a>

  <main id="main" class="content ag-main">
    <h1 class="hero-title">Sobre la audioguía</h1>

    <p>
      Esta audioguía te acompaña en senderos naturales con relatos y sonidos que se activan a
      medida que recorrés el espacio. Está pensada para personas con discapacidad visual y
      también para quienes quieran explorar el entorno de una manera distinta.
    </p>
    <p>
      El recorrido puede seguirse con geolocalización: cuando te acercás a un punto de interés,
      se dispara el audio correspondiente. También podés reproducir los audios manualmente si lo
      necesitás.
    </p>
    <p>
      Para usarla sin conexión, es posible descargar los recorridos con anticipación. Así, los
      audios quedan disponibles incluso cuando no hay señal o datos móviles.
    </p>
    <p>
      Agradecimientos: a Los Búhos Bariloche, a Yamila, Lucas, Karin, Andre, Guille y Axel.
    </p>

    <hr />

    <section class="about" aria-labelledby="creditos-meta-title">
      <p>
        <strong>Iniciativa:</strong> COA Tucúquere Bariloche / Aves Argentinas
      </p>
      <p>
        <strong>Última actualización:</strong> {LAST_UPDATE}
      </p>
      <p>
        <strong>Versión app:</strong> {APP_VERSION}
      </p>
      <p>
        <strong>Versión contenidos:</strong> {CONTENT_VERSION}
      </p>
      <p>
        © {CURRENT_YEAR} Audioguía Natural. Todos los derechos reservados.
      </p>
    </section>
  </main>
</div>
