<script lang="ts">
  import { base } from "$app/paths";
  import { APP_VERSION, CONTENT_VERSION } from "$lib/version";

  const appBase = base;
  const LAST_UPDATE = new Date().toISOString().slice(0, 10);
  const CURRENT_YEAR = new Date().getFullYear();

  const actions = [
    {
      title: "Recorridos cerca de mí",
      subtitle: "Ver recorridos disponibles según tu ubicación",
      href: `${appBase}/cerca`,
      ariaLabel: "Ir a Recorridos cerca de mí"
    },
    {
      title: "Recorridos offline",
      subtitle: "Recorridos descargados para usar sin conexión",
      href: `${appBase}/offline`,
      ariaLabel: "Ir a Recorridos offline"
    },
    {
      title: "Explorar recorridos",
      subtitle: "Ver todos los recorridos disponibles",
      href: `${appBase}/explorar`,
      ariaLabel: "Ir a Explorar recorridos"
    }
  ];
</script>

<div class="page">
  <a class="skip-link" href="#main">Saltar al contenido</a>

  <main id="main" class="content ag-main">
    <h1 class="hero-title">Senderos para escuchar</h1>
    <p class="hero-blurb">
      Una audioguía accesible para recorrer senderos naturales a través del sonido. Pensada para
      personas ciegas, abierta a todo público.
    </p>
    <p class="hero-subtitle">
      Elegí un recorrido para empezar a caminar con audio guiado. Se recomienda descargar el tour
      antes de salir del Wi-Fi o de una buena conexión de datos.
    </p>

    <div class="home-actions">
      {#each actions as action, index}
        <a class="home-card" href={action.href} aria-label={action.ariaLabel}>
          <span class="home-icon" aria-hidden="true">
            {#if index === 0}
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
                <path
                  d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
                  fill="currentColor"
                />
              </svg>
            {:else if index === 1}
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
                <path
                  d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3 1.4 1.42L12 17.41l-4.7-4.7 1.4-1.42 2.3 2.3V4a1 1 0 0 1 1-1zm-7 16h14v2H5v-2z"
                  fill="currentColor"
                />
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false">
                <path
                  d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z"
                  fill="currentColor"
                />
              </svg>
            {/if}
          </span>
          <span class="home-text">
            <span class="home-title">{action.title}</span>
            <span class="home-subtitle">{action.subtitle}</span>
          </span>
        </a>
      {/each}
    </div>

    <section class="about" aria-labelledby="about-title">
      <h2 id="about-title">About</h2>
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
        <strong>Versión Content:</strong> {CONTENT_VERSION}
      </p>
      <p>
        © {CURRENT_YEAR} Audioguía Natural. Todos los derechos reservados.
      </p>
    </section>
  </main>
</div>
