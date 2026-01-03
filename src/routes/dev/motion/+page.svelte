<script lang="ts">
  import { base } from "$app/paths";
  import { browser, dev } from "$app/environment";
  import FootstepsIndicator from "$lib/components/FootstepsIndicator.svelte";
  import ListeningFigure from "$lib/components/motion/ListeningFigure.svelte";
  import { getDevModeFromStorage } from "$lib/data/tours";

  const appBase = base;
  let devMode = false;
  $: devMode = browser ? getDevModeFromStorage() : false;
  $: canShow = dev || devMode;
</script>

{#if canShow}
  <main
    style="
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem 1rem 3rem;
      gap: 1.5rem;
      text-align: center;
      background: #1f1f1f;
      color: #ffffff;
    "
  >
    <a href={`${appBase}/`} style="text-decoration: none; color: inherit;">← Volver</a>

    <header style="max-width: 720px;">
      <h1 style="margin: 0 0 0.5rem;">Movimiento (preview)</h1>
      <p style="margin: 0; opacity: 0.7;">
        Vista rápida de las animaciones del indicador de movimiento.
      </p>
    </header>

    <section
      style="
        width: 100%;
        max-width: 720px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
        justify-items: center;
      "
    >
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <FootstepsIndicator label="Caminando" />
        <span style="font-size: 0.85rem; opacity: 0.7;">Walking</span>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
        <ListeningFigure active={true} />
        <span style="font-size: 0.85rem; opacity: 0.7;">Listening</span>
      </div>
    </section>
  </main>
{:else}
  <main style="min-height: 100vh; display: grid; place-items: center; text-align: center; padding: 2rem;">
    <p style="margin: 0;">Esta página solo está disponible en modo dev.</p>
  </main>
{/if}
