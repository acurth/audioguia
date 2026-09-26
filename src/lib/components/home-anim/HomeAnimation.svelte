<script lang="ts">
	// The "Cómo funciona" loop that replaced the photo on Inicio. The markup is
	// the package's snippet.html as delivered; audioguia-anim.js drives it.
	// The package's own safeguards stay: it pauses when off screen or when the
	// tab is hidden, and with "reduce motion" on it shows one still frame.
	import { onMount } from 'svelte';
	import './audioguia-anim.css';
	import { start } from './audioguia-anim.js';

	let wrap: HTMLDivElement;
	let anim: { stop: () => void; setPaused: (p: boolean) => void } | null = null;
	let paused = $state(false);
	let reduceMotion = $state(false);

	onMount(() => {
		const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => (reduceMotion = mq.matches);
		syncMotion();
		mq.addEventListener('change', syncMotion);
		anim = start(wrap);
		return () => {
			mq.removeEventListener('change', syncMotion);
			anim?.stop();
			anim = null;
		};
	});

	function togglePause() {
		paused = !paused;
		anim?.setPaused(paused);
	}
</script>

<!-- The frame fills whatever box the page gives it; the square inside takes
     the shorter side, so it fits a tall phone column and a wide desktop
     column alike without cropping. -->
<div class="ag-frame">
	<div class="ag-box">
		<div
			class="ag-wrap"
			id="ag-wrap"
			bind:this={wrap}
			role="img"
			aria-label="Animación: cómo funciona audioguia.io. Descargás el recorrido, lo iniciás cerca del primer punto y, mientras caminás, tu posición GPS activa audios sobre aves, leyendas y naturaleza, y avisos de obstáculos. Se camina acompañado: quien acompaña guía con el teléfono y quien escucha disfruta del relato."
		>
			<div id="ag-stage" aria-hidden="true">
				<!-- Escena 1 / 5 -->
				<div class="ag-layer" id="ag-L1">
					<div class="ag-abs" id="ag-introT">
						<div>¿Cómo funciona<br />audioguia<span class="ag-g">.io</span>?</div>
					</div>
					<div class="ag-abs" id="ag-endT">¡Disfruten de<br />los Senderos!</div>
					<div class="ag-abs" id="ag-endS">
						Compartí con alguien a quien le pueda gustar esta experiencia
					</div>
				</div>

				<!-- Header -->
				<div class="ag-layer" id="ag-LH">
					<div class="ag-abs ag-logo" id="ag-logoSmall"></div>
					<div class="ag-abs" id="ag-stepPill">
						<span class="n" id="ag-stepN">1</span><span id="ag-stepT">Elegí un sendero</span>
					</div>
				</div>

				<!-- Map -->
				<div class="ag-layer" id="ag-LM">
					<div class="ag-abs" id="ag-mapCard">
						<svg id="ag-mapSvg" viewBox="0 0 960 640" xmlns="http://www.w3.org/2000/svg">
							<!-- water -->
							<path
								d="M0 470 C 120 430, 200 520, 330 500 C 430 485, 470 560, 560 600 L 560 640 L 0 640 Z"
								fill="#cfe3ea"
							/>
							<path
								d="M0 500 C 110 470, 190 540, 300 525"
								fill="none"
								stroke="#b9d5de"
								stroke-width="6"
								stroke-linecap="round"
							/>
							<path
								d="M60 560 C 160 540, 220 600, 330 590"
								fill="none"
								stroke="#b9d5de"
								stroke-width="6"
								stroke-linecap="round"
							/>
							<!-- forest patches (flat) -->
							<g fill="#5e946c">
								<circle cx="110" cy="120" r="46" /><circle cx="175" cy="90" r="38" /><circle
									cx="70"
									cy="200"
									r="34"
								/>
								<circle cx="880" cy="110" r="52" /><circle cx="820" cy="170" r="40" /><circle
									cx="905"
									cy="220"
									r="36"
								/>
								<circle cx="700" cy="560" r="44" /><circle cx="770" cy="600" r="38" /><circle
									cx="850"
									cy="540"
									r="48"
								/>
								<circle cx="430" cy="80" r="34" /><circle cx="490" cy="60" r="30" />
							</g>
							<g fill="#37874d">
								<circle cx="140" cy="150" r="30" /><circle cx="860" cy="150" r="34" /><circle
									cx="735"
									cy="585"
									r="30"
								/><circle cx="460" cy="95" r="24" />
							</g>
							<!-- trail -->
							<path
								id="ag-trail"
								d="M120 330 C 200 300, 260 210, 360 230 C 470 250, 480 380, 580 380 C 680 380, 700 260, 790 260 C 860 260, 880 340, 870 430"
								fill="none"
								stroke="#d9c9a8"
								stroke-width="26"
								stroke-linecap="round"
							/>
							<path
								id="ag-trailDash"
								d="M120 330 C 200 300, 260 210, 360 230 C 470 250, 480 380, 580 380 C 680 380, 700 260, 790 260 C 860 260, 880 340, 870 430"
								fill="none"
								stroke="#ffffff"
								stroke-width="5"
								stroke-dasharray="14 22"
								stroke-linecap="round"
							/>
							<!-- walked part (drawn over) -->
							<path
								id="ag-trailDone"
								d="M120 330 C 200 300, 260 210, 360 230 C 470 250, 480 380, 580 380 C 680 380, 700 260, 790 260 C 860 260, 880 340, 870 430"
								fill="none"
								stroke="#2a7440"
								stroke-width="10"
								stroke-linecap="round"
								opacity="0.9"
							/>
							<!-- start / end -->
							<g id="ag-startMark"
								><circle
									cx="120"
									cy="330"
									r="22"
									fill="#fff"
									stroke="#2a7440"
									stroke-width="6"
								/><text
									x="120"
									y="378"
									text-anchor="middle"
									font-family="Nunito"
									font-weight="800"
									font-size="24"
									fill="#2a7440">INICIO</text
								></g
							>
							<g id="ag-endMark"
								><circle
									cx="870"
									cy="430"
									r="18"
									fill="#fff"
									stroke="#102c44"
									stroke-width="6"
								/></g
							>
							<!-- audio points: pin with sound icon -->
							<g id="ag-pins"></g>
							<!-- GPS dot -->
							<g id="ag-gps">
								<circle
									id="ag-gpsRing1"
									r="24"
									fill="none"
									stroke="#102c44"
									stroke-width="4"
									opacity="0"
								/>
								<circle
									id="ag-gpsRing2"
									r="24"
									fill="none"
									stroke="#102c44"
									stroke-width="4"
									opacity="0"
								/>
								<circle r="34" fill="#102c44" opacity="0.18" />
								<circle r="17" fill="#102c44" stroke="#fff" stroke-width="5" />
							</g>
							<!-- trigger rings -->
							<g id="ag-trig"
								><circle
									id="ag-trigA"
									r="10"
									fill="none"
									stroke="#2a7440"
									stroke-width="6"
									opacity="0"
								/><circle
									id="ag-trigB"
									r="10"
									fill="none"
									stroke="#2a7440"
									stroke-width="6"
									opacity="0"
								/></g
							>
						</svg>
						<div class="ag-abs" id="ag-startBtn">
							<svg
								width="40"
								height="40"
								viewBox="0 0 24 24"
								fill="none"
								stroke="#fff"
								stroke-width="2.4"
								stroke-linecap="round"
								stroke-linejoin="round"><path d="M8 5v14l11-7z" /></svg
							>
							<span>Iniciar recorrido</span>
						</div>
						<div class="ag-abs" id="ag-tapRing"></div>
						<div class="ag-abs" id="ag-dlBtn">
							<div id="ag-dlFill"></div>
							<div id="ag-dlLabel"></div>
						</div>
						<div class="ag-abs" id="ag-tapRing2"></div>
						<div class="ag-abs" id="ag-audioCard">
							<div id="ag-audioIcon"></div>
							<div id="ag-audioText">
								<div id="ag-audioTitle">Los sonidos de las aves</div>
								<div id="ag-audioSub">Relato de 1 minuto</div>
							</div>
							<div id="ag-wave">
								<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
							</div>
						</div>
					</div>
				</div>

				<!-- Escena 4: companions -->
				<div class="ag-layer" id="ag-LP">
					<div class="ag-abs" id="ag-pair">
						<svg id="ag-pairSvg" viewBox="0 0 960 640" xmlns="http://www.w3.org/2000/svg">
							<!-- ground -->
							<rect x="0" y="520" width="960" height="120" fill="#d9c9a8" />
							<path d="M0 520 C 200 500, 400 540, 960 515 L 960 640 L 0 640 Z" fill="#cbb992" />
							<!-- trees -->
							<g fill="#5e946c"
								><circle cx="90" cy="300" r="70" /><circle cx="160" cy="240" r="55" /><circle
									cx="890"
									cy="280"
									r="75"
								/><circle cx="830" cy="220" r="50" /></g
							>
							<g fill="#37874d"
								><circle cx="120" cy="330" r="40" /><circle cx="850" cy="320" r="44" /></g
							>
							<rect x="80" y="330" width="20" height="190" fill="#8a6a3a" /><rect
								x="858"
								y="330"
								width="22"
								height="190"
								fill="#8a6a3a"
							/>
							<!-- companion (left) holding phone -->
							<g id="ag-pCompanion" transform="translate(-90 0)">
								<circle cx="380" cy="190" r="46" fill="#102c44" />
								<rect x="332" y="240" width="96" height="170" rx="40" fill="#2a7440" />
								<rect x="350" y="400" width="26" height="120" rx="12" fill="#102c44" /><rect
									x="386"
									y="400"
									width="26"
									height="120"
									rx="12"
									fill="#102c44"
								/>
								<!-- arm and phone -->
								<rect x="418" y="270" width="80" height="26" rx="13" fill="#2a7440" />
								<rect x="482" y="236" width="54" height="92" rx="10" fill="#102c44" />
								<rect x="489" y="246" width="40" height="72" rx="6" fill="#e9f4ed" />
								<circle cx="509" cy="270" r="10" fill="#5e946c" /><rect
									x="493"
									y="286"
									width="32"
									height="6"
									rx="3"
									fill="#2a7440"
								/><rect x="493" y="298" width="22" height="6" rx="3" fill="#2a7440" />
							</g>
							<!-- listener (right) with headphones and cane -->
							<g id="ag-pListener" transform="translate(50 0)">
								<circle cx="620" cy="190" r="46" fill="#102c44" />
								<path
									d="M574 186 a46 46 0 0 1 92 0"
									fill="none"
									stroke="#2a7440"
									stroke-width="12"
									stroke-linecap="round"
								/>
								<rect x="562" y="176" width="18" height="34" rx="9" fill="#2a7440" /><rect
									x="660"
									y="176"
									width="18"
									height="34"
									rx="9"
									fill="#2a7440"
								/>
								<rect x="572" y="240" width="96" height="170" rx="40" fill="#102c44" />
								<rect x="590" y="400" width="26" height="120" rx="12" fill="#2a7440" /><rect
									x="626"
									y="400"
									width="26"
									height="120"
									rx="12"
									fill="#2a7440"
								/>
								<rect
									x="520"
									y="300"
									width="70"
									height="26"
									rx="13"
									fill="#102c44"
									transform="rotate(-8 555 313)"
								/>
								<g id="ag-cane" stroke-linecap="round"
									><line
										x1="522"
										y1="318"
										x2="499"
										y2="522"
										stroke="#102c44"
										stroke-width="14"
									/><line
										x1="522"
										y1="318"
										x2="499.5"
										y2="518"
										stroke="#ffffff"
										stroke-width="8"
									/><line
										x1="506.2"
										y1="463.4"
										x2="500.4"
										y2="514.5"
										stroke="#c62828"
										stroke-width="8"
										stroke-linecap="butt"
									/><line
										x1="522"
										y1="318"
										x2="519.4"
										y2="342"
										stroke="#102c44"
										stroke-width="12"
									/></g
								>
							</g>
							<!-- sound waves to listener -->
							<g
								id="ag-pWaves"
								transform="translate(30 -40)"
								fill="none"
								stroke="#2a7440"
								stroke-width="10"
								stroke-linecap="round"
							>
								<path id="ag-pw1" d="M700 150 a60 60 0 0 1 0 80" />
								<path id="ag-pw2" d="M730 130 a90 90 0 0 1 0 120" />
								<path id="ag-pw3" d="M760 110 a120 120 0 0 1 0 160" />
							</g>
							<!-- labels -->
							<text
								x="290"
								y="590"
								text-anchor="middle"
								font-family="Nunito"
								font-weight="800"
								font-size="30"
								fill="#102c44">Quien acompaña: guía</text
							>
							<text
								x="670"
								y="590"
								text-anchor="middle"
								font-family="Nunito"
								font-weight="800"
								font-size="30"
								fill="#102c44">Quien escucha: disfruta</text
							>
						</svg>
					</div>
				</div>

				<!-- Captions -->
				<div class="ag-layer" id="ag-LC">
					<div class="ag-abs" id="ag-cap">
						<div id="ag-capT"></div>
						<div id="ag-capS"></div>
					</div>
				</div>
			</div>
		</div>
		<!-- WCAG 2.2.2: anything that moves for more than 5 seconds needs a way
		     to stop it. The button sits outside the role="img" element, because
		     the children of an image are hidden from screen readers. With
		     "reduce motion" on there is nothing moving, so there is no button. -->
		{#if !reduceMotion}
			<button
				type="button"
				class="ag-pause"
				aria-label={paused ? 'Reanudar la animación' : 'Pausar la animación'}
				aria-pressed={paused}
				onclick={togglePause}
			>
				{#if paused}
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
						><path d="M8 5v14l11-7z" fill="currentColor" /></svg
					>
				{:else}
					<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
						><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect
							x="14"
							y="5"
							width="4"
							height="14"
							rx="1"
							fill="currentColor"
						/></svg
					>
				{/if}
			</button>
		{/if}
	</div>
</div>

<style>
	.ag-frame {
		position: absolute;
		inset: 0;
		container-type: size;
		display: grid;
		place-items: center;
	}

	.ag-box {
		position: relative;
		width: min(100cqw, 100cqh);
		aspect-ratio: 1 / 1;
	}

	/* 44 px target, in the corner the animation leaves empty in every scene. */
	.ag-pause {
		position: absolute;
		right: 6px;
		bottom: 6px;
		width: 44px;
		height: 44px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: #3b5064;
		cursor: pointer;
		opacity: 0.55;
	}

	.ag-pause:hover,
	.ag-pause:focus-visible,
	.ag-pause[aria-pressed='true'] {
		opacity: 1;
	}

	.ag-pause svg {
		display: block;
	}
</style>
