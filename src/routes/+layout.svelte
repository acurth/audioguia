<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	onMount(() => {
		if ('serviceWorker' in navigator) {
			const swUrl = `${base}/service-worker.js`;

			navigator.serviceWorker
				.register(swUrl, { scope: `${base}/`, type: 'module' })
				.catch((err) => console.error('SW registration failed', err));
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
