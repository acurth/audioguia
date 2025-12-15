<script lang="ts">
  import { base } from "$app/paths";

  type TourJson = {
    id?: string;
    slug?: string;
    name?: string;
    theme?: string;
  };

  type TourLink = {
    id: string;
    slug: string;
    label: string;
    theme?: string;
  };

  const tourModules = import.meta.glob("$lib/data/tours/*.json", {
    eager: true,
    import: "default"
  }) as Record<string, TourJson>;

  const tours: TourLink[] = Object.entries(tourModules)
    .map(([path, data]) => {
      const filename = path.split("/").pop() ?? "";
      const idFromFile = filename.replace(".json", "");

      const id = typeof data.id === "string" ? data.id : idFromFile;
      const slug = typeof data.slug === "string" ? data.slug : id;
      const label = typeof data.name === "string" ? data.name : id;
      const theme = typeof data.theme === "string" ? data.theme : undefined;

      return { id, slug, label, theme };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
</script>

<main
  style="
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 2rem 1rem;
    text-align: center;
  "
>
  <h1 style="font-size: 1.8rem; margin-bottom: 0.25rem;">
    Guía Auditiva – Llao Llao
  </h1>

  <p style="max-width: 520px; font-size: 0.95rem; margin: 0 auto 1.5rem;">
    Elegí un recorrido para empezar a caminar con audio guiado.
  </p>

  <div
    style="
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      width: 100%;
      max-width: 360px;
    "
  >
    {#if tours.length === 0}
      <p style="font-size: 0.9rem; margin: 0;">
        Todavía no hay recorridos configurados.
      </p>
    {:else}
      {#each tours as tour}
        <a
          href={`${base}/${tour.slug}`}
          style="
            text-decoration: none;
            padding: 0.85rem 1.25rem;
            border-radius: 999px;
            border: 1px solid rgba(0,0,0,0.1);
            background: #f4f9ff;
            font-weight: 600;
            font-size: 0.95rem;
          "
        >
          {tour.label}
        </a>
      {/each}
    {/if}
  </div>
</main>
