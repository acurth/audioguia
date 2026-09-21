<script lang="ts" module>
	export type SortKey = 'cerca' | 'cortos' | 'nombre';
</script>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	type Props = {
		sort: SortKey;
		onlyDownloaded: boolean;
		onlyAccessible: boolean;
		/** Hidden when no tour carries the accessible flag, so no dead control. */
		showAccessible: boolean;
		/** Set while the browser is still resolving the position. */
		locating?: boolean;
		onSort: (sort: SortKey) => void;
		onToggleDownloaded: () => void;
		onToggleAccessible: () => void;
	};

	let {
		sort,
		onlyDownloaded,
		onlyAccessible,
		showAccessible,
		locating = false,
		onSort,
		onToggleDownloaded,
		onToggleAccessible
	}: Props = $props();
</script>

<!-- Two groups in one strip: the first picks the order, the second narrows the
     list. They are separate groups so a screen reader announces which is
     which, rather than reading five unrelated toggles in a row. -->
<div class="fb">
	<div class="fb-group" role="group" aria-label="Ordenar los recorridos">
		<button
			type="button"
			class="fb-chip"
			class:is-on={sort === 'cerca'}
			aria-pressed={sort === 'cerca'}
			onclick={() => onSort('cerca')}
		>
			<Icon name="map-pin" size={13} stroke={2.2} />
			Cerca mío
			{#if locating && sort === 'cerca'}
				<span class="sr-only">buscando tu ubicación</span>
			{/if}
		</button>
		<button
			type="button"
			class="fb-chip"
			class:is-on={sort === 'cortos'}
			aria-pressed={sort === 'cortos'}
			onclick={() => onSort('cortos')}
		>
			Más cortos
		</button>
		<button
			type="button"
			class="fb-chip"
			class:is-on={sort === 'nombre'}
			aria-pressed={sort === 'nombre'}
			onclick={() => onSort('nombre')}
		>
			Por nombre
		</button>
	</div>

	<div class="fb-group" role="group" aria-label="Filtrar los recorridos">
		{#if showAccessible}
			<button
				type="button"
				class="fb-chip"
				class:is-on={onlyAccessible}
				aria-pressed={onlyAccessible}
				onclick={onToggleAccessible}
			>
				<Icon name="accessibility" size={13} stroke={2.2} />
				Accesibles
			</button>
		{/if}
		<button
			type="button"
			class="fb-chip"
			class:is-on={onlyDownloaded}
			aria-pressed={onlyDownloaded}
			onclick={onToggleDownloaded}
		>
			<Icon name="download" size={13} stroke={2.2} />
			Descargados
		</button>
	</div>
</div>

<style>
	.fb {
		display: flex;
		align-items: center;
		gap: 14px;
		/* The strip scrolls sideways on a narrow phone rather than wrapping
		   into two rows and pushing the list down. */
		overflow-x: auto;
		scrollbar-width: none;
		padding-bottom: 2px;
	}

	.fb::-webkit-scrollbar {
		display: none;
	}

	.fb-group {
		display: flex;
		align-items: center;
		gap: 7px;
		flex: none;
	}

	/* A hairline between the two groups, so the strip reads as two things. */
	.fb-group + .fb-group {
		padding-left: 14px;
		border-left: 1px solid var(--ag-border);
	}

	.fb-chip {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		flex: none;
		/* The mockup draws these 34 px high. The floor for this app is 44,
		   and 38 in landscape, which is what the token carries. */
		min-height: var(--ag-target);
		padding: 6px 12px;
		background: var(--ag-surface);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-pill);
		color: var(--ag-fg-1);
		font-family: inherit;
		font-size: 12.5px;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}

	/* The pressed chip is marked by fill, border and weight together, never
	   by colour alone. */
	.fb-chip.is-on {
		background: var(--ag-green-soft);
		border-color: var(--ag-green-line);
		color: var(--ag-green-ink);
		box-shadow: inset 0 0 0 1px var(--ag-green-line);
	}

	.fb-chip:hover {
		border-color: var(--ag-green);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
