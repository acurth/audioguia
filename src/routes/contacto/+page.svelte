<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';

	/**
	 * Contact form. It posts JSON to api/contacto.php, which sends the email by
	 * SMTP with credentials kept outside the site. Nothing secret is here.
	 *
	 * There is no CAPTCHA on purpose: the app is made for people with visual
	 * impairment, and a visual puzzle would lock them out. Abuse is handled on
	 * the server with a hidden field, a minimum fill time and a per-address limit.
	 */

	const LIMITS = { nombre: 100, email: 254, asunto: 150, mensaje: 5000 };

	let nombre = $state('');
	let email = $state('');
	let asunto = $state('');
	let mensaje = $state('');
	let sitioWeb = $state('');

	type Status = 'idle' | 'sending' | 'sent' | 'error';
	let status = $state<Status>('idle');
	let notice = $state('');
	let online = $state(true);
	let openedAt = 0;

	onMount(() => {
		openedAt = Date.now();
		online = navigator.onLine;
		const update = () => (online = navigator.onLine);
		window.addEventListener('online', update);
		window.addEventListener('offline', update);
		return () => {
			window.removeEventListener('online', update);
			window.removeEventListener('offline', update);
		};
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (status === 'sending') return;

		const form = event.currentTarget as HTMLFormElement;
		if (!form.reportValidity()) return;

		if (!navigator.onLine) {
			status = 'error';
			notice = 'No hay conexión. El mensaje se puede enviar cuando vuelvas a tener señal.';
			return;
		}

		status = 'sending';
		notice = 'Enviando…';

		try {
			const response = await fetch(`${base}/api/contacto.php`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({
					nombre,
					email,
					asunto,
					mensaje,
					sitio_web: sitioWeb,
					tiempo: Date.now() - openedAt
				})
			});
			const data = (await response.json().catch(() => null)) as {
				ok?: boolean;
				error?: string;
			} | null;

			if (response.ok && data?.ok) {
				status = 'sent';
				notice = 'Gracias por escribirnos. Recibimos tu mensaje y te respondemos por email.';
				nombre = email = asunto = mensaje = '';
				return;
			}
			status = 'error';
			notice = data?.error ?? 'No pudimos enviar el mensaje. Probá de nuevo más tarde.';
		} catch {
			status = 'error';
			notice = 'No pudimos enviar el mensaje. Revisá la conexión y probá de nuevo.';
		}
	}
</script>

<svelte:head>
	<title>Contacto · Audioguía Natural</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page-contacto">
	<!-- Contacto is reached from Cuenta, so its back button goes there. -->
	<a class="co-back" href={`${base}/cuenta`} aria-label="Volver a Cuenta">
		<Icon name="chevron-left" size={18} />
	</a>

	<main id="main" class="co-main">
		<h1>Contacto</h1>
		<p class="co-lede">
			Escribinos con dudas, sugerencias o si encontraste algo que no funciona bien.
		</p>

		{#if !online}
			<p class="co-offline" role="status">
				<Icon name="alert" size={18} />
				Estás sin conexión. Podés escribir el mensaje, y enviarlo cuando vuelvas a tener señal.
			</p>
		{/if}

		<form class="co-form" onsubmit={submit}>
			<label>
				<span>Nombre</span>
				<input
					type="text"
					name="nombre"
					autocomplete="name"
					required
					maxlength={LIMITS.nombre}
					bind:value={nombre}
				/>
			</label>

			<label>
				<span>Email</span>
				<input
					type="email"
					name="email"
					autocomplete="email"
					inputmode="email"
					required
					maxlength={LIMITS.email}
					bind:value={email}
				/>
			</label>

			<label>
				<span>Asunto</span>
				<input type="text" name="asunto" required maxlength={LIMITS.asunto} bind:value={asunto} />
			</label>

			<label>
				<span>Mensaje</span>
				<textarea name="mensaje" rows="6" required maxlength={LIMITS.mensaje} bind:value={mensaje}
				></textarea>
			</label>

			<!-- Honeypot. Hidden from sight and from screen readers; people leave it empty. -->
			<div class="co-trap" aria-hidden="true">
				<label>
					Sitio web
					<input
						type="text"
						name="sitio_web"
						tabindex="-1"
						autocomplete="off"
						bind:value={sitioWeb}
					/>
				</label>
			</div>

			<button type="submit" class="co-submit" disabled={status === 'sending'}>
				<Icon name="mail" size={18} />
				{status === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
			</button>

			<p
				class="co-notice"
				class:is-error={status === 'error'}
				class:is-sent={status === 'sent'}
				role={status === 'error' ? 'alert' : 'status'}
				aria-live="polite"
			>
				{notice}
			</p>
		</form>
	</main>
</div>

<style>
	.page-contacto {
		flex: 1;
		position: relative;
		background: var(--ag-surface);
	}

	.co-back {
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

	.co-back:hover {
		border-color: var(--ag-green);
		color: var(--ag-green-ink);
	}

	.co-main {
		max-width: 560px;
		margin: 0 auto;
		padding: var(--ag-top-logo) var(--ag-side) var(--ag-section);
	}

	h1 {
		margin: 0 0 6px;
		font-size: 25px;
		font-weight: 800;
		letter-spacing: -0.015em;
		text-align: center;
		color: var(--ag-fg-1);
	}

	.co-lede {
		margin: 0 0 20px;
		font-size: 14.5px;
		line-height: 1.6;
		text-align: center;
		color: var(--ag-fg-2);
	}

	.co-offline {
		display: flex;
		gap: 8px;
		align-items: flex-start;
		margin: 0 0 16px;
		padding: 12px 14px;
		background: var(--ag-page);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-md);
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--ag-fg-1);
	}

	.co-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.co-form label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		font-weight: 700;
		color: var(--ag-fg-1);
	}

	.co-form input,
	.co-form textarea {
		width: 100%;
		min-height: var(--ag-target);
		padding: 10px 12px;
		font: inherit;
		font-weight: 400;
		font-size: 16px; /* 16 px or iOS zooms the page on focus */
		color: var(--ag-fg-1);
		background: var(--ag-surface);
		border: 1px solid var(--ag-border-control);
		border-radius: var(--ag-r-md);
		box-sizing: border-box;
	}

	.co-form textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.co-form input:focus-visible,
	.co-form textarea:focus-visible {
		outline: 3px solid var(--ag-green);
		outline-offset: 1px;
		border-color: var(--ag-green);
	}

	.co-trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	.co-submit {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: var(--ag-target);
		padding: 0 1.25rem;
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		color: #fff;
		background: var(--ag-green-ink);
		border: none;
		border-radius: var(--ag-r-pill);
		cursor: pointer;
	}

	.co-submit:hover:not(:disabled) {
		background: var(--ag-navy);
	}

	.co-submit:disabled {
		opacity: 0.7;
		cursor: progress;
	}

	.co-notice {
		margin: 0;
		min-height: 1.5em;
		font-size: 14px;
		line-height: 1.5;
		color: var(--ag-fg-2);
	}

	.co-notice.is-error {
		color: var(--ag-danger);
		font-weight: 600;
	}

	.co-notice.is-sent {
		color: var(--ag-green-ink);
		font-weight: 600;
	}

	@media (min-width: 600px) and (orientation: landscape) {
		.co-main {
			padding-top: 20px;
		}
	}
</style>
