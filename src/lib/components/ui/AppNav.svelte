<script lang="ts">
	import { base } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { NAV_ITEMS, navHref, type NavSection } from '$lib/nav';

	type Props = {
		/** Which tab is current. Pass null on screens that are not tabs. */
		current: NavSection | null;
		/**
		 * 'light' is the white bar used on every light screen. 'dark' is the
		 * inverted bar for the tour in progress: on #0B2033 the active green
		 * reaches 6.4:1, which it does not on the navy page background.
		 */
		variant?: 'light' | 'dark';
	};

	let { current, variant = 'light' }: Props = $props();
</script>

<nav class="ag-nav ag-nav--{variant}" aria-label="Navegación principal">
	<ul>
		{#each NAV_ITEMS as item (item.section)}
			{@const isCurrent = item.section === current}
			<li>
				<a
					href={navHref(base, item.path)}
					aria-current={isCurrent ? 'page' : undefined}
					class:is-current={isCurrent}
				>
					<Icon name={item.icon} size={22} stroke={isCurrent ? 2.4 : 2} />
					<span class="ag-nav-label">{item.label}</span>
				</a>
			</li>
		{/each}
	</ul>
</nav>

<style>
	/* Portrait phone, and tablet in portrait: a bar across the bottom of the
	   screen. It is exactly --ag-nav-height tall, plus the safe area, and
	   pages read that same amount from --ag-nav-inset-block, so nothing has
	   to measure the bar at runtime. */
	.ag-nav {
		/* Fixed, not sticky. Sticky puts the bar in the flow at the end of the
		   page, and Safari does not honour bottom-sticky inside a flex column,
		   so the bar drifted with the content. Fixed pins it to the bottom of
		   the window whatever the page height, which is what this bar is for.
		   The page reserves the same height through --ag-nav-inset-block. */
		position: fixed;
		inset: auto 0 0 0;
		z-index: 40;
		box-sizing: border-box;
		height: calc(var(--ag-nav-height) + env(safe-area-inset-bottom, 0px));
		padding-bottom: env(safe-area-inset-bottom, 0px);
		background: var(--ag-surface);
		border-top: 1px solid var(--ag-border);
	}

	.ag-nav--dark {
		background: var(--ag-navy-nav);
		border-top-color: rgba(255, 255, 255, 0.1);
	}

	.ag-nav ul {
		display: flex;
		align-items: stretch;
		height: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.ag-nav li {
		flex: 1 1 0;
		display: flex;
	}

	.ag-nav a {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		box-sizing: border-box;
		min-height: 0;
		margin: 5px;
		padding: 4px 2px;
		border-radius: var(--ag-r-md);
		/* The mockups use the muted grey here. It is the label of a real
		   control, so it takes the body colour instead: 7.4:1 rather than
		   2.4:1. The current tab is still obvious from the tinted pill,
		   the heavier weight and the green. */
		color: var(--ag-fg-2);
		font-weight: 600;
		text-decoration: none;
		transition:
			background-color var(--ag-motion-fast) var(--ag-ease),
			color var(--ag-motion-fast) var(--ag-ease);
	}

	.ag-nav--dark a {
		color: var(--ag-on-dark-3);
	}

	/* 12 px, not the 10 px of the mockups: these labels are the primary
	   navigation of an app whose users include people with low vision. */
	.ag-nav-label {
		font-size: 12px;
		line-height: 1.2;
	}

	/* The current tab is marked three ways, not by colour alone: heavier
	   weight, a tinted pill, and aria-current for the screen reader. */
	.ag-nav a.is-current {
		color: var(--ag-green-ink);
		background: var(--ag-green-soft);
		font-weight: 700;
	}

	.ag-nav--dark a.is-current {
		color: var(--ag-green-on-navy);
		background: rgba(79, 181, 108, 0.14);
	}

	.ag-nav a:hover {
		color: var(--ag-green-ink);
	}

	.ag-nav--dark a:hover {
		color: var(--ag-green-on-navy);
	}

	.ag-nav a:focus-visible {
		outline: 3px solid var(--ag-green-ink);
		outline-offset: -3px;
	}

	.ag-nav--dark a:focus-visible {
		outline-color: var(--ag-green-on-navy);
	}

	/* Landscape phone and tablet: the bar becomes a rail down the left side,
	   because the height is what runs out in landscape. */
	@media (min-width: 600px) and (orientation: landscape) {
		.ag-nav {
			/* Landscape turns the same bar into a rail down the left edge. */
			inset: 0 auto 0 0;
			height: auto;
			width: var(--ag-rail-width);
			padding-bottom: 0;
			padding-left: env(safe-area-inset-left, 0px);
			border-top: none;
			border-right: 1px solid var(--ag-border);
		}

		.ag-nav--dark {
			border-right-color: rgba(255, 255, 255, 0.1);
		}

		.ag-nav ul {
			flex-direction: column;
			justify-content: center;
			gap: 6px;
			height: 100%;
			padding: 14px 0;
			box-sizing: border-box;
		}

		.ag-nav li {
			flex: 0 0 auto;
		}

		.ag-nav a {
			min-height: var(--ag-target);
			margin: 0 8px;
			padding: 8px 0;
		}

		.ag-nav-label {
			font-size: 11px;
		}
	}
</style>
