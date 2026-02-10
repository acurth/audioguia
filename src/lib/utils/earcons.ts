import { base } from "$app/paths";

const EARCON_VOLUME = 0.5;

const getEarconUrl = (filename: string) => `${base}/media/ui/${filename}`;

async function playEarcon(filename: string) {
  if (typeof Audio === "undefined") return;

  const audio = new Audio(getEarconUrl(filename));
  audio.volume = EARCON_VOLUME;

  try {
    await audio.play();
  } catch {
    // Ignore autoplay or playback failures.
  }
}

export async function playTrackingOn() {
  await playEarcon("tracking-on.mp3");
}

export async function playTrackingOff() {
  await playEarcon("tracking-off.mp3");
}
