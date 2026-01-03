<script lang="ts">
  import FootstepsIndicator from "$lib/components/FootstepsIndicator.svelte";
  import ListeningFigure from "$lib/components/motion/ListeningFigure.svelte";

  export let isTracking: boolean;
  export let isMoving: boolean;
</script>

{#if isTracking}
  <div class="motion-wrap">
    {#if isMoving}
      <FootstepsIndicator label="Caminando" />
    {:else}
      <span role="img" aria-label="Escuchando">
        <ListeningFigure active={true} />
      </span>
    {/if}
  </div>
{/if}

<style>
  .motion-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 120px;
  }
</style>
