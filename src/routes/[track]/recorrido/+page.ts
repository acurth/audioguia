export const prerender = true;

import { getTourRecords } from "$lib/data/tours";

export const entries = async () => {
	return getTourRecords(false).map((tour) => ({ track: tour.slug }));
};
