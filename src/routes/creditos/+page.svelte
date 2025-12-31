<script lang="ts">
  import { APP_VERSION, CONTENT_VERSION } from "$lib/version";

  const LAST_UPDATE = new Date().toISOString().slice(0, 10);
  const CURRENT_YEAR = new Date().getFullYear();
</script>

<div class="page">
  <a class="skip-link" href="#main">Saltar al contenido</a>

  <main id="main" class="content ag-main">
    <h1 class="hero-title">Créditos</h1>

    <section class="about" aria-labelledby="creditos-meta-title">
      <p>
        <strong>Iniciativa:</strong> COA Tucúquere Bariloche / Aves Argentinas
      </p>
      <p>
        <strong>Last Update:</strong> {LAST_UPDATE}
      </p>
      <p>
        <strong>Versión App:</strong> {APP_VERSION}
      </p>
      <p>
        <strong>Versión Contenido:</strong> {CONTENT_VERSION}
      </p>
      <p>
        © {CURRENT_YEAR} Audioguía Natural. Todos los derechos reservados.
      </p>
    </section>

    <section aria-labelledby="creditos-about-title">
      <h2 id="creditos-about-title" class="hero-subtitle">Sobre la audioguía</h2>
      <span id="ayuda" class="sr-only">Ayuda</span>
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
        <a href="#ayuda" aria-label="Ayuda">Ayuda</a>
      </p>
    </section>

    <p>
      Agradecimientos: a Los Búhos Bariloche, a Yamila T., a Lucas, a Karin, a Guille, a Andre.
    </p>
  </main>
</div>
