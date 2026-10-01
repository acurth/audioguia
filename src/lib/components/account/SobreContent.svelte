<script lang="ts">
	import { base } from '$app/paths';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { APP_VERSION, CONTENT_VERSION, LAST_UPDATE } from '$lib/config/version';

	/**
	 * What the audioguide is, who made it, and the version data. Shown on
	 * /sobre and inside the "Sobre la audioguía" row of Cuenta.
	 */
	type Props = {
		/** 2 on its own page, 3 inside Cuenta, where the row is the h2. */
		level?: 2 | 3;
		/** Opens the contact form on the same screen. Without it, a link. */
		onContact?: () => void;
	};

	let { level = 2, onContact }: Props = $props();

	const heading = $derived(`h${level}`);
	const currentYear = new Date().getFullYear();

	const features = [
		{
			icon: 'headphones' as const,
			title: 'Pensada para escuchar',
			text: 'Está hecha para personas con discapacidad visual, y también para quienes quieran recorrer el entorno de otra manera.'
		},
		{
			icon: 'map-pin' as const,
			title: 'Los audios se disparan solos',
			text: 'Cuando te acercás a un punto de interés se reproduce el relato, sin que tengas que tocar la pantalla.'
		},
		{
			icon: 'download' as const,
			title: 'Funciona sin conexión',
			text: 'Descargá el recorrido antes de salir y los audios quedan disponibles aunque no haya señal ni datos.'
		}
	];
</script>

<ul class="so-features">
	{#each features as feature (feature.title)}
		<li>
			<span class="so-feature-icon" aria-hidden="true">
				<Icon name={feature.icon} size={20} stroke={2.2} />
			</span>
			<div>
				<svelte:element this={heading} class="so-feature-title">{feature.title}</svelte:element>
				<p>{feature.text}</p>
			</div>
		</li>
	{/each}
</ul>

<section class="so-block" aria-labelledby="so-thanks">
	<Eyebrow label="Agradecimientos" />
	<svelte:element this={heading} id="so-thanks" class="sr-only">Agradecimientos</svelte:element>
	<p class="so-thanks-text">Pablo, Yamila, Lucas, Karin, Andre, Guille, Lorenzo, Juan y Axel.</p>
</section>

<section class="so-block" aria-labelledby="so-contact">
	<Eyebrow label="Contacto" />
	<svelte:element this={heading} id="so-contact" class="sr-only">Contacto</svelte:element>
	<p class="so-thanks-text">
		¿Una duda o una sugerencia?
		{#if onContact}
			<button type="button" class="so-link" onclick={onContact}>Escribinos</button>.
		{:else}
			<a href={`${base}/contacto`}>Escribinos</a>.
		{/if}
	</p>
</section>

<section class="so-block so-meta" aria-labelledby="so-meta-title">
	<svelte:element this={heading} id="so-meta-title" class="sr-only"
		>Datos del proyecto</svelte:element
	>
	<dl>
		<div>
			<dt>Proyecto</dt>
			<dd>audioguia.io</dd>
		</div>
		<div>
			<dt>Última actualización</dt>
			<dd>{LAST_UPDATE}</dd>
		</div>
		<div>
			<dt>Versión app</dt>
			<dd>{APP_VERSION}</dd>
		</div>
		<div>
			<dt>Versión contenidos</dt>
			<dd>{CONTENT_VERSION}</dd>
		</div>
	</dl>
	<p class="so-copy">© {currentYear} audioguia.io. Todos los derechos reservados.</p>
</section>

<style>
	.so-features {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.so-features li {
		display: flex;
		gap: 12px;
		padding: 14px 15px;
		background: var(--ag-surface);
		border: 1px solid var(--ag-border);
		border-radius: var(--ag-r-md);
	}

	.so-feature-icon {
		display: flex;
		flex: none;
		color: var(--ag-green-ink);
	}

	.so-feature-title {
		margin: 0 0 4px;
		font-size: 14px;
		font-weight: 700;
		color: var(--ag-fg-1);
	}

	.so-features p {
		margin: 0;
		font-size: 13px;
		line-height: 1.55;
		color: var(--ag-fg-2);
	}

	.so-block {
		padding-top: var(--ag-section);
	}

	.so-thanks-text {
		margin: var(--ag-eyebrow-gap) 0 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--ag-fg-2);
	}

	.so-thanks-text a,
	.so-link {
		color: var(--ag-green-ink);
		font-weight: 700;
	}

	.so-link {
		padding: 0;
		font: inherit;
		font-weight: 700;
		background: none;
		border: none;
		text-decoration: underline;
		cursor: pointer;
	}

	.so-meta dl {
		margin: 0;
		padding-top: 14px;
		border-top: 1px solid var(--ag-border);
		font-size: 13px;
		line-height: 1.7;
		color: var(--ag-fg-3);
	}

	.so-meta dl div {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.so-meta dt {
		font-weight: 700;
		color: var(--ag-fg-2);
	}

	.so-meta dt::after {
		content: ':';
	}

	.so-meta dd {
		margin: 0;
	}

	.so-copy {
		margin: 14px 0 0;
		font-size: 12px;
		color: var(--ag-muted);
	}

	/* The three cards go side by side when the screen is wide and short:
	   stacked they would need scrolling for nothing. */
	@media (min-width: 600px) and (orientation: landscape) {
		.so-features {
			flex-direction: row;
		}

		.so-features li {
			flex: 1;
			min-width: 0;
		}

		.so-block {
			padding-top: 16px;
		}
	}
</style>
