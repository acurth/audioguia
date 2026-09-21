<script lang="ts">
	// Section label: a short green rule, then the label in small caps.
	type Props = { label: string; onDark?: boolean };
	let { label, onDark = false }: Props = $props();
</script>

<span class="ag-eyebrow" class:on-dark={onDark}>
	<span class="ag-eyebrow-rule" aria-hidden="true"></span>
	{label}
</span>

<style>
	.ag-eyebrow {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ag-green-ink);
	}

	.ag-eyebrow.on-dark {
		color: var(--ag-green-on-navy);
	}

	.ag-eyebrow-rule {
		width: 24px;
		height: 2px;
		flex: none;
		background: var(--ag-green);
	}

	.ag-eyebrow.on-dark .ag-eyebrow-rule {
		background: var(--ag-green-on-navy);
	}
</style>
