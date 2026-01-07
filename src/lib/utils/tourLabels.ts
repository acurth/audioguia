export function openTourLabel(tour: { name?: string; slug?: string }): string {
  if (tour.name) return `Abrir ${tour.name}`;
  return "Abrir recorrido";
}
