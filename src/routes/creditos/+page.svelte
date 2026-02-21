<script lang="ts">
  import { APP_VERSION, CONTENT_VERSION, LAST_UPDATE } from "$lib/config/version";
  const CURRENT_YEAR = new Date().getFullYear();
</script>

<div class="page">
  <a class="skip-link" href="#main">Saltar al contenido</a>

  <main id="main" class="content ag-main">
    <h1 class="hero-title">Sobre la audioguía</h1>

    <section class="creditos-body" aria-labelledby="creditos-body-title">
      <h2 id="creditos-body-title" class="sr-only">Descripción</h2>
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
        Agradecimientos: Pablo, Yamila, Lucas, Karin, Andre, Guille, Lorenzo, Juan y Axel.
      </p>
    </section>

    <hr />

    <section class="about" aria-labelledby="creditos-meta-title">
      <p>
        <strong>Proyecto:</strong> audioguia.io
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

<style>
  .creditos-body {
    max-width: 640px;
    margin: 0 auto;
    text-align: left;
  }

  .creditos-body p {
    margin: 0 0 0.75em;
  }

  .creditos-body p:last-child {
    margin-bottom: 0;
  }
</style>
