<script lang="ts">
  import { base } from "$app/paths";

  export let isTracking: boolean;
  export let isMoving: boolean;

  const appBase = base;
  $: stateClass = isMoving ? "is-walking" : "is-listening";
</script>

{#if isTracking}
  <div class="motion-indicator-wrap">
    <svg
      class={`motion-indicator ${stateClass}`}
      width="72"
      height="120"
      viewBox="0 0 64 120"
      aria-hidden="true"
    >
      <use href={`${appBase}/media/ui/motion-indicator.svg#state-walk`} class="state-walk" />
      <use href={`${appBase}/media/ui/motion-indicator.svg#state-listen`} class="state-listen" />
    </svg>
    <span class="sr-only" aria-live="polite">
      {isMoving ? "En movimiento" : "Escuchando"}
    </span>
  </div>
{/if}

<style>
  .motion-indicator-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .motion-indicator .state-walk,
  .motion-indicator .state-listen {
    display: none;
  }

  .motion-indicator.is-walking .state-walk {
    display: inline;
  }

  .motion-indicator.is-listening .state-listen {
    display: inline;
  }
</style>
