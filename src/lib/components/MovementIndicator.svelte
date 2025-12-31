<script lang="ts">
  export let isTracking: boolean;
  export let isMoving: boolean;
</script>

{#if isTracking}
  <div class="motion-wrap">
    <svg
      class={`motion-icon motion-walk ${isMoving ? "is-active" : ""}`}
      viewBox="0 0 64 120"
      width="72"
      height="120"
      aria-hidden="true"
      overflow="visible"
    >
      <g class="body-bob">
        <circle cx="32" cy="18" r="8" fill="#ffffff" />
        <line x1="32" y1="26" x2="32" y2="54" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
        <line class="arm arm-left" x1="32" y1="36" x2="18" y2="48" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
        <line class="arm arm-right" x1="32" y1="36" x2="46" y2="46" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
        <line class="leg leg-left" x1="32" y1="54" x2="18" y2="78" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
        <line class="leg leg-right" x1="32" y1="54" x2="46" y2="78" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
      </g>
    </svg>
    <svg
      class={`motion-icon motion-listen ${isMoving ? "" : "is-active"}`}
      viewBox="0 0 64 120"
      width="72"
      height="120"
      aria-hidden="true"
      overflow="visible"
    >
      <circle cx="32" cy="18" r="8" fill="#ffffff" />
      <line x1="32" y1="26" x2="32" y2="54" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
      <line x1="32" y1="36" x2="18" y2="48" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
      <line x1="32" y1="36" x2="46" y2="48" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
      <line x1="32" y1="54" x2="22" y2="78" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
      <line x1="32" y1="54" x2="42" y2="78" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />

      <g class="wave wave-left">
        <path d="M18 16c-3 3-3 7 0 10" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M14 12c-4.5 4.5-4.5 11 0 15.5" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M10 8c-6 6-6 14 0 20" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
      </g>
      <g class="wave wave-right">
        <path d="M46 16c3 3 3 7 0 10" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M50 12c4.5 4.5 4.5 11 0 15.5" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
        <path d="M54 8c6 6 6 14 0 20" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
      </g>
    </svg>
    <span class="sr-only" aria-live="polite">
      {isMoving ? "En movimiento" : "Escuchando"}
    </span>
  </div>
{/if}

<style>
  .motion-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 72px;
    height: 120px;
  }

  .motion-icon {
    position: absolute;
    inset: 0;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .motion-icon.is-active {
    opacity: 1;
  }

  .motion-icon .leg,
  .motion-icon .arm,
  .motion-icon .wave,
  .motion-icon .body-bob {
    transform-box: fill-box;
    transform-origin: center;
  }

  .motion-walk.is-active .leg-left {
    animation: leg-left 0.9s ease-in-out infinite;
  }

  .motion-walk.is-active .leg-right {
    animation: leg-right 0.9s ease-in-out infinite;
  }

  .motion-walk.is-active .arm-left {
    animation: arm-left 0.9s ease-in-out infinite;
  }

  .motion-walk.is-active .arm-right {
    animation: arm-right 0.9s ease-in-out infinite;
  }

  .motion-walk.is-active .body-bob {
    animation: body-bob 0.9s ease-in-out infinite;
  }

  .motion-listen.is-active .wave-left,
  .motion-listen.is-active .wave-right {
    animation: wave-pulse 1.1s ease-in-out infinite;
  }

  .motion-listen.is-active .wave-right {
    animation-delay: 0.15s;
  }

  @keyframes leg-left {
    0% { transform: rotate(12deg); }
    50% { transform: rotate(-10deg); }
    100% { transform: rotate(12deg); }
  }

  @keyframes leg-right {
    0% { transform: rotate(-12deg); }
    50% { transform: rotate(10deg); }
    100% { transform: rotate(-12deg); }
  }

  @keyframes arm-left {
    0% { transform: rotate(-8deg); }
    50% { transform: rotate(6deg); }
    100% { transform: rotate(-8deg); }
  }

  @keyframes arm-right {
    0% { transform: rotate(8deg); }
    50% { transform: rotate(-6deg); }
    100% { transform: rotate(8deg); }
  }

  @keyframes body-bob {
    0% { transform: translateY(0); }
    50% { transform: translateY(2px); }
    100% { transform: translateY(0); }
  }

  @keyframes wave-pulse {
    0% { opacity: 0.35; transform: translateX(0); }
    50% { opacity: 1; transform: translateX(2px); }
    100% { opacity: 0.35; transform: translateX(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .motion-walk.is-active .leg-left,
    .motion-walk.is-active .leg-right,
    .motion-walk.is-active .arm-left,
    .motion-walk.is-active .arm-right,
    .motion-walk.is-active .body-bob,
    .motion-listen.is-active .wave-left,
    .motion-listen.is-active .wave-right {
      animation: none;
    }
  }
</style>
