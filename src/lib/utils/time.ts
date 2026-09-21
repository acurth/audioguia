/** Clock strings for the player and the walk timer. */
export function formatClock(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const total = Math.floor(seconds);
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** The same, but spoken: screen readers read "1:12" as a time of day. */
export function spokenDuration(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds < 0) return '0 segundos';
	const total = Math.round(seconds);
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	const parts: string[] = [];
	if (mins > 0) parts.push(`${mins} ${mins === 1 ? 'minuto' : 'minutos'}`);
	if (secs > 0 || mins === 0) parts.push(`${secs} ${secs === 1 ? 'segundo' : 'segundos'}`);
	return parts.join(' y ');
}
