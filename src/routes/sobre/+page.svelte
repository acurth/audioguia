<script lang="ts">
	import { base } from '$app/paths';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { APP_VERSION, CONTENT_VERSION, LAST_UPDATE } from '$lib/config/version';

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

<div class="page-sobre">
	<!-- Sobre is not a tab, so it carries a back button. -->
	<a class="so-back" href={`${base}/`} aria-label="Volver al inicio">
		<Icon name="chevron-left" size={18} />
	</a>

	<main id="main">
		<section class="so-intro">
			<img
				class="so-logo"
				src={`${base}/branding/isologo-horizontal.png`}
				alt="audioguia.io"
				width="987"
				height="248"
			/>
			<h1>Senderos para escuchar</h1>
			<p class="so-lede">Una audioguía accesible para recorrer senderos a través del sonido.</p>

			<ul class="so-features">
				{#each features as feature (feature.title)}
					<li>
						<span class="so-feature-icon" aria-hidden="true">
							<Icon name={feature.icon} size={20} stroke={2.2} />
						</span>
						<div>
							<h2>{feature.title}</h2>
							<p>{feature.text}</p>
						</div>
					</li>
				{/each}
			</ul>
		</section>

		<section class="so-block" aria-labelledby="so-thanks">
			<Eyebrow label="Agradecimientos" />
			<h2 id="so-thanks" class="sr-only">Agradecimientos</h2>
			<p class="so-thanks-text">
				Pablo, Yamila, Lucas, Karin, Andre, Guille, Lorenzo, Juan y Axel.
			</p>
		</section>

		<section class="so-block" aria-labelledby="so-contact">
			<Eyebrow label="Contacto" />
			<h2 id="so-contact" class="sr-only">Contacto</h2>
			<p class="so-thanks-text">
				¿Una duda o una sugerencia? <a href={`${base}/contacto`}>Escribinos</a>.
			</p>
		</section>

		<section class="so-block so-meta" aria-labelledby="so-meta-title">
			<h2 id="so-meta-title" class="sr-only">Datos del proyecto</h2>
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
	</main>
</div>

<style>
	.page-sobre {
		flex: 1;
		position: relative;
		background: var(--ag-surface);
	}

	.so-back {
		position: absolute;
		top: 16px;
		inset-inline-start: 16px;
		z-index: 2;
		width: var(--ag-target);
		height: var(--ag-target);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--ag-page);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-pill);
		color: var(--ag-fg-1);
		text-decoration: none;
	}

	.so-back:hover {
		border-color: var(--ag-green);
		color: var(--ag-green-ink);
	}

	.so-intro {
		padding: var(--ag-top-logo) var(--ag-side) 0;
	}

	.so-logo {
		width: 224px;
		height: 56px;
		max-width: 100%;
		display: block;
		margin: 0 auto 18px;
		object-fit: contain;
	}

	.so-intro h1 {
		margin: 0 0 6px;
		font-size: 25px;
		font-weight: 800;
		letter-spacing: -0.015em;
		text-align: center;
		color: var(--ag-fg-1);
	}

	.so-lede {
		margin: 0 0 20px;
		font-size: 14.5px;
		line-height: 1.6;
		text-align: center;
		color: var(--ag-fg-2);
	}

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

	.so-features h2 {
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
		padding: var(--ag-section) var(--ag-side) 0;
	}

	.so-thanks-text {
		margin: var(--ag-eyebrow-gap) 0 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--ag-fg-2);
	}

	.so-meta {
		padding-bottom: var(--ag-section);
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

	@media (min-width: 600px) and (orientation: landscape) {
		.so-intro {
			padding: 20px var(--ag-side-land) 0;
		}

		.so-back {
			top: 14px;
			inset-inline-start: 14px;
		}

		.so-logo {
			margin-bottom: 12px;
		}

		.so-intro h1 {
			font-size: 22px;
		}

		.so-lede {
			margin-bottom: 14px;
		}

		/* The three cards go side by side: in landscape the height is what
		   runs out, and stacked they would need scrolling for nothing. */
		.so-features {
			flex-direction: row;
		}

		.so-features li {
			flex: 1;
			min-width: 0;
		}

		.so-block {
			padding: 16px var(--ag-side-land) 0;
		}

		.so-meta {
			padding-bottom: 20px;
		}
	}

	/* Tablet in portrait: phone structure, text capped so it stays readable. */
	@media (min-width: 600px) and (orientation: portrait) {
		.so-intro,
		.so-block {
			max-width: 760px;
			margin-inline: auto;
		}
	}
</style>
