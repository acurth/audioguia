let wakeLock: WakeLockSentinel | null = null;

function notifyRelease() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("wake-lock-release"));
  }
}

export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export async function requestWakeLock(): Promise<boolean> {
  if (!isWakeLockSupported()) return false;
  if (wakeLock) return true;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    if (wakeLock?.addEventListener) {
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
        notifyRelease();
      });
    }
    return true;
  } catch {
    wakeLock = null;
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch {
    // ignore
  } finally {
    wakeLock = null;
  }
}
