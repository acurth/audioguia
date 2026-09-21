/**
 * Sharing a trail. The phone share sheet when the browser has one, the
 * clipboard when it does not, and a message saying which happened either
 * way, because a silent copy leaves people wondering.
 */
export async function shareLink(input: {
	title: string;
	text: string;
	url: string;
}): Promise<string> {
	if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
		try {
			await navigator.share(input);
			return '';
		} catch (err) {
			// Cancelling the share sheet is not a failure, and must not show
			// an error.
			if (err instanceof DOMException && err.name === 'AbortError') return '';
		}
	}

	try {
		await navigator.clipboard.writeText(input.url);
		return 'Copiamos el link del recorrido.';
	} catch {
		return `Copiá este link: ${input.url}`;
	}
}
