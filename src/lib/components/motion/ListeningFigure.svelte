<script lang="ts">
  export let active = false;
</script>

<svg
  class={`listen-figure ${active ? "is-active" : ""}`}
  viewBox="0 0 120 120"
  width="72"
  height="120"
  aria-hidden="true"
>
  <circle cx="60" cy="20" r="8" fill="#ffffff" />
  <line x1="60" y1="28" x2="60" y2="60" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
  <line x1="60" y1="40" x2="44" y2="52" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
  <line x1="60" y1="40" x2="76" y2="52" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
  <line x1="60" y1="60" x2="50" y2="88" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
  <line x1="60" y1="60" x2="70" y2="88" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />

  <g class="wave wave-left">
    <path d="M44 16c-3 3-3 7 0 10" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M38 12c-4.5 4.5-4.5 11 0 15.5" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M32 8c-6 6-6 14 0 20" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
  </g>
  <g class="wave wave-right">
    <path d="M76 16c3 3 3 7 0 10" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M82 12c4.5 4.5 4.5 11 0 15.5" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
    <path d="M88 8c6 6 6 14 0 20" stroke="#ffffff" stroke-width="3" stroke-linecap="round" fill="none" />
  </g>
</svg>

<style>
  .listen-figure {
    display: block;
  }

  .listen-figure .wave {
    transform-box: fill-box;
    transform-origin: center;
  }

  .listen-figure.is-active .wave-left,
  .listen-figure.is-active .wave-right {
    animation: wave-pulse 1.2s ease-in-out infinite;
  }

  .listen-figure.is-active .wave-right {
    animation-delay: 0.15s;
  }

  @keyframes wave-pulse {
    0% { opacity: 0.35; transform: translateX(0); }
    50% { opacity: 1; transform: translateX(2px); }
    100% { opacity: 0.35; transform: translateX(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .listen-figure.is-active .wave-left,
    .listen-figure.is-active .wave-right {
      animation: none;
    }
  }
</style>
