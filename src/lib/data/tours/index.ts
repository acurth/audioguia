export type TourStatus = "prod" | "test";

export type OfflineFile = { path: string; bytes: number };
export type OfflineManifest = { totalBytes?: number; files?: OfflineFile[] };

export type TourJson = {
  id?: string;
  slug?: string;
  name?: string;
  theme?: string;
  status?: TourStatus;
  offline?: OfflineManifest;
  points?: unknown[];
};

export type TourRecord = {
  id: string;
  slug: string;
  status: TourStatus;
  data: TourJson;
};

export const getDevModeFromStorage = () => {
  const inSession =
    typeof sessionStorage !== "undefined" && sessionStorage.getItem("devMode") === "1";
  if (inSession) return true;
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("dev") === "1";
};

const tourModules = import.meta.glob("$lib/data/tours/*.json", {
  eager: true,
  import: "default"
}) as Record<string, TourJson>;

const getStatus = (status?: TourStatus): TourStatus => (status === "test" ? "test" : "prod");

export function getTourRecords(devMode: boolean): TourRecord[] {
  const tours = Object.entries(tourModules).map(([path, data]) => {
    const filename = path.split("/").pop() ?? "";
    const idFromFile = filename.replace(".json", "");
    const id = typeof data.id === "string" ? data.id : idFromFile;
    const slug = typeof data.slug === "string" ? data.slug : id;
    const status = getStatus(data.status);

    return { id, slug, status, data };
  });

  if (devMode) return tours;
  return tours.filter((tour) => tour.status === "prod");
}
