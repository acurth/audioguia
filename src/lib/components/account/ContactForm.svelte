<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CONTACT_REASONS } from '$lib/config/contact';

	/**
	 * Contact form. It posts JSON to api/contacto.php, which sends the email by
	 * SMTP with credentials kept outside the site. Nothing secret is here.
	 * Used inside Cuenta and on the /contacto page.
	 *
	 * There is no CAPTCHA on purpose: the app is made for people with visual
	 * impairment, and a visual puzzle would lock them out. The small sum is
	 * plain text, so a screen reader reads it like any other question. Abuse
	 * is also handled on the server with a hidden field, a minimum fill time
	 * and a per-address limit.
	 */
	type Props = {
		/** The reason chosen. Para editores sets it before opening the form. */
		motivo?: string;
		/** Prefix for the field ids, so two forms never share an id. */
		idPrefix?: string;
	};

	let { motivo = $bindable(''), idPrefix = 'co' }: Props = $props();

	const LIMITS = { nombre: 100, email: 254, asunto: 150, mensaje: 5000 };

	let nombre = $state('');
	let email = $state('');
	let asunto = $state('');
	let mensaje = $state('');
	let suma = $state('');
	let sitioWeb = $state('');
	// Picked in the browser, not at build time, so every visit gets a new sum.
	let sumA = $state(0);
	let sumB = $state(0);

	type Status = 'idle' | 'sending' | 'sent' | 'error';
	let status = $state<Status>('idle');
	let notice = $state('');
	let online = $state(true);
	let openedAt = 0;

	function newSum() {
		sumA = 1 + Math.floor(Math.random() * 9);
		sumB = 1 + Math.floor(Math.random() * 9);
		suma = '';
	}

	onMount(() => {
		openedAt = Date.now();
		newSum();
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

		if (Number(suma) !== sumA + sumB) {
			status = 'error';
			notice = `La suma no da ${suma}. ¿Cuánto es ${sumA} más ${sumB}?`;
			return;
		}

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
					motivo,
					nombre,
					email,
					asunto,
					mensaje,
					suma_a: sumA,
					suma_b: sumB,
					suma: Number(suma),
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
				motivo = '';
				newSum();
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

{#if !online}
	<p class="co-offline" role="status">
		<Icon name="alert" size={18} />
		Estás sin conexión. Podés escribir el mensaje, y enviarlo cuando vuelvas a tener señal.
	</p>
{/if}

<form class="co-form" onsubmit={submit}>
	<label for={`${idPrefix}-motivo`}>
		<span>Motivo</span>
		<span class="co-select">
			<select id={`${idPrefix}-motivo`} name="motivo" required bind:value={motivo}>
				<option value="" disabled>Elegí un motivo</option>
				{#each CONTACT_REASONS as reason (reason)}
					<option value={reason}>{reason}</option>
				{/each}
			</select>
			<span class="co-select-icon" aria-hidden="true">
				<Icon name="chevron-down" size={18} />
			</span>
		</span>
	</label>

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

	<!-- A sum in words a screen reader can say, to keep simple bots out. -->
	<label class="co-sum">
		<span>¿Cuánto es {sumA || '…'} más {sumB || '…'}?</span>
		<input
			type="text"
			name="suma"
			inputmode="numeric"
			pattern="[0-9]*"
			autocomplete="off"
			required
			maxlength="2"
			bind:value={suma}
		/>
	</label>

	<!-- Honeypot. Hidden from sight and from screen readers; people leave it empty. -->
	<div class="co-trap" aria-hidden="true">
		<label>
			Sitio web
			<input type="text" name="sitio_web" tabindex="-1" autocomplete="off" bind:value={sitioWeb} />
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

<style>
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
		position: relative;
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
	.co-form textarea,
	.co-form select {
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

	/* The native list opens the phone's own picker, which a screen reader
	   already knows. Only the closed box is restyled, to match the fields. */
	.co-select {
		position: relative;
		display: block;
	}

	.co-form select {
		appearance: none;
		-webkit-appearance: none;
		padding-right: 40px;
	}

	.co-select-icon {
		position: absolute;
		top: 50%;
		right: 12px;
		transform: translateY(-50%);
		display: flex;
		color: var(--ag-fg-2);
		pointer-events: none;
	}

	.co-sum input {
		max-width: 96px;
	}

	.co-form textarea {
		resize: vertical;
		line-height: 1.5;
	}

	.co-form input:focus-visible,
	.co-form textarea:focus-visible,
	.co-form select:focus-visible {
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
</style>
