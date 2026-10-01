/**
 * Sharing a trail, or the app. The phone share sheet when the browser has one, the
 * clipboard when it does not, and a message saying which happened either
 * way, because a silent copy leaves people wondering.
 */
export async function shareLink(input: {
	title: string;
	text: string;
	url: string;
	/** What to say when the link went to the clipboard instead. */
	copiedMessage?: string;
}): Promise<string> {
	const { copiedMessage = 'Copiamos el link del recorrido.', ...shared } = input;
	if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
		try {
			await navigator.share(shared);
			return '';
		} catch (err) {
			// Cancelling the share sheet is not a failure, and must not show
			// an error.
			if (err instanceof DOMException && err.name === 'AbortError') return '';
		}
	}

	try {
		await navigator.clipboard.writeText(input.url);
		return copiedMessage;
	} catch {
		return `Copiá este link: ${input.url}`;
	}
}
