export function openTourLabel(tour: { id?: string; name?: string; slug?: string }): string {
  const label = tour.name ?? tour.slug ?? tour.id ?? "recorrido";
  return `Abrir ${label}`;
}
