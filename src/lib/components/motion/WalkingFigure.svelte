<script lang="ts">
  export let active = false;
</script>

<svg
  class="walk-figure {active ? 'is-active' : ''}"
  viewBox="0 0 80 120"
  width="72"
  height="120"
  aria-hidden="true"
>
  <!-- Head -->
  <circle cx="40" cy="16" r="8" fill="#fff" />

  <!-- Torso -->
  <line
    x1="40" y1="24"
    x2="40" y2="56"
    stroke="#fff"
    stroke-width="4"
    stroke-linecap="round"
  />

  <!-- Arms (animate the GROUP, not the line) -->
  <g class="arm front">
    <line
      x1="40" y1="32"
      x2="28" y2="48"
      stroke="#fff"
      stroke-width="4"
      stroke-linecap="round"
    />
  </g>

  <g class="arm back">
    <line
      x1="40" y1="32"
      x2="52" y2="48"
      stroke="#fff"
      stroke-width="4"
      stroke-linecap="round"
    />
  </g>

  <!-- Legs (animate the GROUP, not the line) -->
  <g class="leg front">
    <line
      x1="40" y1="56"
      x2="30" y2="88"
      stroke="#fff"
      stroke-width="4"
      stroke-linecap="round"
    />
  </g>

  <g class="leg back">
    <line
      x1="40" y1="56"
      x2="50" y2="88"
      stroke="#fff"
      stroke-width="4"
      stroke-linecap="round"
    />
  </g>
</svg>

<style>
.walk-figure {
  display: block;
}

/*
  Safari/iOS: transform-origin on raw SVG primitives can be unreliable.
  Animating <g> groups + forcing transform-box/origin stabilizes the pivot.
*/
.arm,
.leg {
  transform-box: fill-box;
  transform-origin: center;
}

.arm {
  transform-origin: 40px 32px; /* shoulder in SVG user space */
}
.leg {
  transform-origin: 40px 56px; /* hip in SVG user space */
}

.walk-figure.is-active .leg.front {
  animation: leg-front 0.9s ease-in-out infinite;
}
.walk-figure.is-active .leg.back {
  animation: leg-back 0.9s ease-in-out infinite;
}
.walk-figure.is-active .arm.front {
  animation: arm-front 0.9s ease-in-out infinite;
}
.walk-figure.is-active .arm.back {
  animation: arm-back 0.9s ease-in-out infinite;
}

/* Slightly smaller angles look more “walk”, less “jump rope” */
@keyframes leg-front {
  0%   { transform: rotate(14deg); }
  50%  { transform: rotate(-14deg); }
  100% { transform: rotate(14deg); }
}
@keyframes leg-back {
  0%   { transform: rotate(-14deg); }
  50%  { transform: rotate(14deg); }
  100% { transform: rotate(-14deg); }
}

@keyframes arm-front {
  0%   { transform: rotate(-10deg); }
  50%  { transform: rotate(10deg); }
  100% { transform: rotate(-10deg); }
}
@keyframes arm-back {
  0%   { transform: rotate(10deg); }
  50%  { transform: rotate(-10deg); }
  100% { transform: rotate(10deg); }
}

@media (prefers-reduced-motion: reduce) {
  .walk-figure.is-active .arm,
  .walk-figure.is-active .leg {
    animation: none;
  }
}
</style>
