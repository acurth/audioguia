<script lang="ts">
  export let label: string | undefined = "Caminando";
</script>

<div class="footsteps" role="img" aria-label={label}>
  <svg
    class="footsteps-svg"
    viewBox="0 0 120 120"
    width="96"
    height="120"
    aria-hidden="true"
  >
    <g class="step step-1 foot left">
      <ellipse cx="20" cy="52" rx="6" ry="10" fill="#fff" />
      <circle cx="26" cy="40" r="2.2" fill="#fff" />
      <circle cx="22" cy="38" r="1.8" fill="#fff" />
    </g>
    <g class="step step-2 foot right">
      <ellipse cx="46" cy="68" rx="6" ry="10" fill="#fff" />
      <circle cx="52" cy="56" r="2.2" fill="#fff" />
      <circle cx="48" cy="54" r="1.8" fill="#fff" />
    </g>
    <g class="step step-3 foot left">
      <ellipse cx="72" cy="52" rx="6" ry="10" fill="#fff" />
      <circle cx="78" cy="40" r="2.2" fill="#fff" />
      <circle cx="74" cy="38" r="1.8" fill="#fff" />
    </g>
    <g class="step step-4 foot right">
      <ellipse cx="98" cy="68" rx="6" ry="10" fill="#fff" />
      <circle cx="104" cy="56" r="2.2" fill="#fff" />
      <circle cx="100" cy="54" r="1.8" fill="#fff" />
    </g>
  </svg>
</div>

<style>
  .footsteps {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 96px;
    height: 120px;
  }

  .footsteps-svg {
    display: block;
  }

  .step {
    opacity: 0.25;
    transform-box: fill-box;
    transform-origin: center;
    animation: step-pulse 1.4s ease-in-out infinite;
  }

  .step-2 {
    animation-delay: 0.35s;
  }

  .step-3 {
    animation-delay: 0.7s;
  }

  .step-4 {
    animation-delay: 1.05s;
  }

  .foot {
    transform: rotate(90deg);
  }

  .foot.left {
    transform: rotate(60deg);
  }

  @keyframes step-pulse {
    0% { opacity: 0.2; transform: rotate(90deg) scale(0.9); }
    20% { opacity: 1; transform: rotate(90deg) scale(1); }
    40% { opacity: 0.25; transform: rotate(90deg) scale(0.9); }
    100% { opacity: 0.25; transform: rotate(90deg) scale(0.9); }
  }

  .step.left {
    animation-name: step-pulse-left;
  }

  @keyframes step-pulse-left {
    0% { opacity: 0.2; transform: rotate(60deg) scale(0.9); }
    20% { opacity: 1; transform: rotate(60deg) scale(1); }
    40% { opacity: 0.25; transform: rotate(60deg) scale(0.9); }
    100% { opacity: 0.25; transform: rotate(60deg) scale(0.9); }
  }

  @media (prefers-reduced-motion: reduce) {
    .step {
      animation: none;
      opacity: 0.8;
      transform: rotate(90deg);
    }

    .step.left {
      transform: rotate(60deg);
    }
  }
</style>
