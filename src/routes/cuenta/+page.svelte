<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { base } from '$app/paths';
	import ContactForm from '$lib/components/account/ContactForm.svelte';
	import SobreContent from '$lib/components/account/SobreContent.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TopBar from '$lib/components/ui/TopBar.svelte';
	import { APP_VERSION } from '$lib/config/version';
	import { REASON_NEW_TRAIL, REASON_PROGRAMMING } from '$lib/config/contact';
	import { shareLink } from '$lib/utils/share';

	/**
	 * Cuenta, from the Claude Design mockup: the guest banner, then one list
	 * about the project. Three rows open in place, on the same screen, so
	 * reading Sobre or writing to us never leaves the tab. Compartir is the
	 * only row that acts at once, which is why it has no chevron.
	 *
	 * Signing in comes with the editor accounts (item 6 in PENDIENTES.md).
	 * Until then the button is shown, dimmed, so nobody wonders where it went.
	 */
	type Section = 'sobre' | 'editores' | 'contacto';

	let open = $state<Record<Section, boolean>>({
		sobre: false,
		editores: false,
		contacto: false
	});
	let motivo = $state('');
	let shareNotice = $state('');

	function toggle(section: Section) {
		open[section] = !open[section];
	}

	/** Open one row and bring it into view, as a link to it would. */
	async function reveal(section: Section) {
		open[section] = true;
		await tick();
		document.getElementById(`cu-row-${section}`)?.scrollIntoView({
			behavior: 'smooth',
			block: 'start'
		});
	}

	/** Para editores and Sobre lead into the form with the reason chosen. */
	async function writeTo(reason: string) {
		if (reason) motivo = reason;
		await reveal('contacto');
		document.getElementById('cu-motivo')?.focus({ preventScroll: true });
	}

	async function shareApp() {
		shareNotice = await shareLink({
			title: 'audioguia.io',
			text: 'Senderos para escuchar: una audioguía accesible para recorrer senderos a través del sonido.',
			url: `${window.location.origin}${base}/`,
			copiedMessage: 'Copiamos el link de la app.'
		});
	}

	// /cuenta#contacto, #sobre or #editores opens that row, so a link from
	// anywhere else can land on it.
	onMount(() => {
		const section = window.location.hash.slice(1);
		if (section === 'sobre' || section === 'editores' || section === 'contacto') {
			void reveal(section);
		}
	});
</script>

{#snippet rowHead(section: Section, icon: 'info' | 'mountain' | 'mail', label: string)}
	<h2 class="cu-row-heading">
		<button
			type="button"
			class="cu-row"
			class:is-open={open[section]}
			aria-expanded={open[section]}
			aria-controls={`cu-panel-${section}`}
			onclick={() => toggle(section)}
		>
			<span class="cu-row-icon" aria-hidden="true"><Icon name={icon} size={20} /></span>
			<span class="cu-row-label">{label}</span>
			<span class="cu-row-chevron" aria-hidden="true">
				<Icon name="chevron-right" size={16} />
			</span>
		</button>
	</h2>
{/snippet}

<TopBar title="Cuenta" />

<main id="main" class="cu">
	<section class="cu-guest" aria-labelledby="cu-guest-title">
		<div class="cu-guest-head">
			<span class="cu-guest-icon" aria-hidden="true">
				<Icon name="account" size={22} stroke={2.2} />
			</span>
			<div>
				<h2 id="cu-guest-title" class="cu-guest-title">Estás como invitado</h2>
				<p class="cu-guest-text">Escuchar recorridos no necesita cuenta.</p>
			</div>
		</div>
		<button type="button" class="cu-signin" disabled>
			Iniciar sesión <span class="cu-soon">(pronto)</span>
		</button>
	</section>

	<section class="cu-section" aria-label="El proyecto">
		<Eyebrow label="El proyecto" />

		<div class="cu-list">
			<div class="cu-item" id="cu-row-sobre">
				{@render rowHead('sobre', 'info', 'Sobre la audioguía')}
				<div class="cu-panel" id="cu-panel-sobre" hidden={!open.sobre}>
					<SobreContent level={3} onContact={() => writeTo('')} />
				</div>
			</div>

			<div class="cu-item">
				<button type="button" class="cu-row" onclick={shareApp}>
					<span class="cu-row-icon" aria-hidden="true"><Icon name="share" size={20} /></span>
					<span class="cu-row-label">Compartir la app</span>
				</button>
				{#if shareNotice}
					<p class="cu-share-notice" role="status">{shareNotice}</p>
				{/if}
			</div>

			<div class="cu-item" id="cu-row-editores">
				{@render rowHead('editores', 'mountain', 'Para editores')}
				<div class="cu-panel" id="cu-panel-editores" hidden={!open.editores}>
					<h3 class="cu-panel-title">Creá un sendero en tu zona</h3>
					<p class="cu-panel-text">
						¿Conocés un sendero que podría tener su audioguía? Más adelante vas a poder armarlo
						desde la app con una cuenta de editor. Mientras tanto, lo hacemos juntos:
					</p>
					<ol class="cu-steps">
						<li>Nos contás qué sendero es y dónde queda.</li>
						<li>
							Lo caminás y anotás los puntos, con una foto de cada uno y lo que querés contar.
						</li>
						<li>Grabás los relatos, o te ayudamos a encontrar quién los grabe.</li>
						<li>Nosotros armamos el recorrido y lo publicamos en la app.</li>
					</ol>
					<p class="cu-panel-text">¿Sabés programar y querés sumarte? También te esperamos.</p>
					<div class="cu-actions">
						<button
							type="button"
							class="cu-action cu-action--primary"
							onclick={() => writeTo(REASON_NEW_TRAIL)}
						>
							<Icon name="map-pin" size={17} />
							Quiero crear un sendero
						</button>
						<button type="button" class="cu-action" onclick={() => writeTo(REASON_PROGRAMMING)}>
							<Icon name="plus" size={17} />
							Quiero ayudar a programar
						</button>
					</div>
				</div>
			</div>

			<div class="cu-item" id="cu-row-contacto">
				{@render rowHead('contacto', 'mail', 'Contacto')}
				<div class="cu-panel" id="cu-panel-contacto" hidden={!open.contacto}>
					<p class="cu-panel-text">
						Escribinos con dudas, sugerencias o si encontraste algo que no funciona bien.
					</p>
					<ContactForm bind:motivo idPrefix="cu" />
				</div>
			</div>
		</div>
	</section>

	<p class="cu-version">audioguia.io · versión {APP_VERSION}</p>
</main>

<style>
	.cu {
		flex: 1;
		width: 100%;
		max-width: 680px;
		margin: 0 auto;
		padding: 0 var(--ag-side);
		box-sizing: border-box;
		text-align: start;
	}

	/* ---- Guest banner, as in the mockup ---------------------------------- */
	.cu-guest {
		margin-top: var(--ag-section);
		padding: 18px;
		background: var(--ag-navy);
		border-radius: 12px;
		color: #ffffff;
	}

	.cu-guest-head {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
	}

	.cu-guest-icon {
		width: 44px;
		height: 44px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(79, 181, 108, 0.18);
		border: 1px solid rgba(79, 181, 108, 0.4);
		border-radius: var(--ag-r-pill);
		color: var(--ag-green-on-navy);
	}

	.cu-guest-title {
		margin: 0;
		font-size: 17px;
		font-weight: 800;
		color: #ffffff;
	}

	.cu-guest-text {
		margin: 2px 0 0;
		font-size: 13px;
		color: var(--ag-on-dark-2);
	}

	/* Dimmed, not hidden: the place where signing in will be. The text stays
	   above 4.5:1 on the navy so "(pronto)" is still readable. */
	.cu-signin {
		width: 100%;
		min-height: var(--ag-target);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 12px;
		font: inherit;
		font-size: 14px;
		font-weight: 700;
		color: var(--ag-on-dark-2);
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.22);
		border-radius: var(--ag-r-pill);
		cursor: not-allowed;
	}

	.cu-soon {
		font-weight: 400;
	}

	/* ---- The list -------------------------------------------------------- */
	.cu-section {
		padding-top: var(--ag-section);
	}

	.cu-list {
		margin-top: var(--ag-eyebrow-gap);
		background: var(--ag-surface);
		border: 1px solid var(--ag-border);
		border-radius: var(--ag-r-sm);
		overflow: hidden;
	}

	.cu-item + .cu-item {
		border-top: 1px solid var(--ag-border);
	}

	/* An opened row stops just under the top of the screen, not behind it. */
	.cu-item {
		scroll-margin-top: 12px;
	}

	.cu-row-heading {
		margin: 0;
		font: inherit;
	}

	/* The whole bar is the control, as in the mockup. */
	.cu-row {
		width: 100%;
		min-height: 52px;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 15px;
		font: inherit;
		text-align: start;
		background: var(--ag-surface);
		border: none;
		color: var(--ag-fg-2);
		cursor: pointer;
		box-sizing: border-box;
	}

	.cu-row:hover {
		background: var(--ag-green-soft);
	}

	.cu-row-icon {
		display: flex;
		flex: none;
		color: var(--ag-green);
	}

	.cu-row-label {
		flex: 1;
		font-size: 15px;
		font-weight: 700;
		color: var(--ag-fg-1);
	}

	.cu-row-chevron {
		display: flex;
		flex: none;
		transition: transform 0.2s ease;
	}

	/* Pointing down while open: the content hangs from the bar. */
	.cu-row.is-open .cu-row-chevron {
		transform: rotate(90deg);
	}

	.cu-panel {
		padding: 4px 15px 20px;
		background: var(--ag-page);
		border-top: 1px solid var(--ag-border);
	}

	.cu-panel[hidden] {
		display: none;
	}

	.cu-panel-title {
		margin: 14px 0 6px;
		font-size: 15px;
		font-weight: 700;
		color: var(--ag-fg-1);
	}

	.cu-panel-text {
		margin: 12px 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--ag-fg-2);
	}

	.cu-panel-title + .cu-panel-text {
		margin-top: 0;
	}

	/* The Sobre cards sit on white, so they keep their edge on the tint. */
	#cu-panel-sobre {
		padding-top: 14px;
	}

	.cu-steps {
		margin: 0 0 12px;
		padding-inline-start: 22px;
		font-size: 14px;
		line-height: 1.6;
		color: var(--ag-fg-2);
	}

	.cu-steps li + li {
		margin-top: 4px;
	}

	.cu-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.cu-action {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: var(--ag-target);
		padding: 0 16px;
		font: inherit;
		font-size: 14px;
		font-weight: 700;
		color: var(--ag-green-ink);
		background: var(--ag-surface);
		border: 1px solid var(--ag-green-line);
		border-radius: var(--ag-r-pill);
		cursor: pointer;
	}

	.cu-action:hover {
		border-color: var(--ag-green);
		background: var(--ag-green-soft);
	}

	.cu-action--primary {
		color: #ffffff;
		background: var(--ag-green-ink);
		border-color: var(--ag-green-ink);
	}

	.cu-action--primary:hover {
		background: var(--ag-navy);
		border-color: var(--ag-navy);
	}

	.cu-share-notice {
		margin: 0;
		padding: 0 15px 14px 47px;
		font-size: 13.5px;
		color: var(--ag-green-ink);
		font-weight: 600;
	}

	.cu-version {
		margin: 0;
		padding: var(--ag-section) 0;
		font-size: 12px;
		text-align: center;
		color: var(--ag-muted);
	}

	@media (min-width: 600px) and (orientation: landscape) {
		.cu {
			padding: 0 var(--ag-side-land);
		}

		.cu-guest {
			margin-top: 16px;
		}

		.cu-section {
			padding-top: 16px;
		}
	}
</style>
