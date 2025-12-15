<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register(`${base}/service-worker.js`)
				.catch((err) => console.error('SW registration failed', err));
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
