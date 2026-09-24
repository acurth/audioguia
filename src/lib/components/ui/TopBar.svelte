<script lang="ts">
	import { base } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';

	/**
	 * The 60 px bar on Explorar, Offline and Cuenta: isologo on the left,
	 * search on the right. Inicio and Sobre do not use it, they open with the
	 * large centred isologo instead.
	 */
	type Props = {
		/** Where the search button goes. Leave it out to hide the button. */
		searchHref?: string;
		/**
		 * The page heading, printed at the right end of the bar. It is the
		 * page's h1, so a page that passes it must not carry another one where
		 * this bar is visible. The bar is hidden in landscape, so those layouts
		 * keep their own heading.
		 */
		title?: string;
	};

	let { searchHref, title }: Props = $props();
</script>

<header class="ag-topbar">
	<a class="ag-topbar-logo" href={`${base}/`} aria-label="Ir al inicio">
		<img
			src={`${base}/branding/isologo-horizontal.png`}
			alt="audioguia.io"
			width="987"
			height="248"
		/>
	</a>

	{#if title}
		<h1 class="ag-topbar-title">{title}</h1>
	{/if}

	{#if searchHref}
		<a class="ag-topbar-action" href={searchHref} aria-label="Buscar recorridos">
			<Icon name="search" size={18} />
		</a>
	{/if}
</header>

<style>
	.ag-topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		height: 60px;
		flex: none;
		padding: 0 var(--ag-side);
		background: var(--ag-surface);
		border-bottom: 1px solid var(--ag-border);
		box-sizing: border-box;
	}

	.ag-topbar-logo {
		display: flex;
		align-items: center;
		min-height: var(--ag-target);
		text-decoration: none;
	}

	.ag-topbar-logo img {
		width: 128px;
		height: 32px;
		display: block;
		object-fit: contain;
	}

	.ag-topbar-title {
		margin: 0;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: -0.01em;
		color: var(--ag-fg-1);
	}

	.ag-topbar-action {
		width: var(--ag-target);
		height: var(--ag-target);
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--ag-page);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-pill);
		color: var(--ag-fg-1);
		text-decoration: none;
	}

	.ag-topbar-action:hover {
		border-color: var(--ag-green);
		color: var(--ag-green-ink);
	}

	/* The bar stays on every screen size, including landscape, tablet and
	   desktop. It used to be hidden in landscape to save 60 px of height, on
	   the grounds that the nav rail carried the branding instead. The rail
	   never did, so landscape simply lost the isologo and the rule under it,
	   and each page had to print its own heading in a different shape. One bar
	   everywhere is what keeps the screens reading as one app. */
</style>
