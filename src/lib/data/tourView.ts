import {
	getTourRecords,
	type TourJson,
	type TourStatus,
	type OfflineManifest
} from '$lib/data/tours';
import { estimateTrailMeters, type TourPoint } from '$lib/utils/tourMeta';

/**
 * One tour, shaped the way the screens need it. Explorar, Offline, Inicio and
 * Detalle all read this, so they cannot print different numbers for the same
 * trail.
 */
export type TourView = {
	id: string;
	slug: string;
	name: string;
	status: TourStatus;
	place?: string;
	difficulty?: string;
	accessible: boolean;
	description?: string;
	points: TourPoint[];
	pointCount: number;
	/** Estimated, from the straight lines between consecutive points. */
	lengthMeters: number;
	sizeBytes?: number;
	offline?: OfflineManifest;
	/** Path relative to the app base. */
	imagePath: string;
	raw: TourJson;
};

export function getTourViews(devMode: boolean): TourView[] {
	return getTourRecords(devMode)
		.map(({ id, slug, status, data }) => {
			const points = (Array.isArray(data.points) ? data.points : []) as TourPoint[];
			return {
				id,
				slug,
				name: typeof data.name === 'string' ? data.name : slug,
				status,
				place: typeof data.place === 'string' ? data.place : undefined,
				difficulty: typeof data.difficulty === 'string' ? data.difficulty : undefined,
				accessible: data.accessible === true,
				description: typeof data.description === 'string' ? data.description : undefined,
				points,
				pointCount: points.length,
				lengthMeters: estimateTrailMeters(points),
				sizeBytes: data.offline?.totalBytes,
				offline: data.offline,
				imagePath: `media/tours/${slug}/background.webp`,
				raw: data
			} satisfies TourView;
		})
		.sort((a, b) => {
			if (a.status !== b.status) return a.status === 'test' ? 1 : -1;
			return a.name.localeCompare(b.name, 'es');
		});
}

/** The files a tour needs in the offline cache. */
export function getOfflineFiles(tour: TourView): string[] {
	const listed = tour.offline?.files?.map((file) => file.path).filter(Boolean) ?? [];
	if (listed.length) return Array.from(new Set(listed));

	const fallback = tour.points
		.flatMap((point) => [point.audio, ...(point.photos ?? [])])
		.filter((path): path is string => typeof path === 'string' && path.length > 0);
	fallback.push(tour.imagePath);
	return Array.from(new Set(fallback));
}
