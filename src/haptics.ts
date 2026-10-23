/**
 * Haptics.
 *
 * Obsidian's mobile shell is a Capacitor app, so its Haptics plugin is the way to reach the vibrator.
 * Its impact styles are three fixed waveforms - LIGHT is a 50 ms pulse at 43 % amplitude, MEDIUM 43 ms
 * at 71 %, HEAVY 60 ms at 100 % - and on a phone the top two are indistinguishable while the bottom one
 * is half strength. So the styles are not used: every tap is a single pulse at full amplitude through
 * vibrate({ duration }), and the nuance is carried by length, which a finger reads far more reliably
 * than force.
 *
 * Nothing here may ever throw into a click handler.
 */

export type HapticStyle = "tick" | "light" | "medium" | "heavy";

const DURATIONS: Record<HapticStyle, number> = {
  tick: 13,   // the crackle of a sweep: short, but 10 ms was under the finger's threshold
  light: 15,  // a button answering a press
  medium: 22, // a middle ground, unused for now
  heavy: 32   // a shape taken: an event, not a beat
};

interface CapacitorHaptics {
  vibrate?: (options: { duration: number }) => Promise<void>;
}

/** Where a call ended up: the plugin, the vibration API, or nowhere. */
export type HapticPath = "capacitor" | "vibrate" | "none";

let observer: ((style: HapticStyle, path: HapticPath) => void) | null = null;

export function observeHaptics(next: ((style: HapticStyle, path: HapticPath) => void) | null): void {
  observer = next;
}

/** What this device offers, in one line: the first thing to know when nothing is felt. */
export function describeHaptics(): string {
  const capacitor = (globalThis as { Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } } }).Capacitor;
  const plugin = capacitor?.Plugins?.Haptics;
  const vibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  return `capacitor ${capacitor ? "oui" : "non"} · haptics ${plugin?.vibrate ? "oui" : "non"} · vibrate ${vibrate ? "oui" : "non"}`;
}

export function haptic(style: HapticStyle = "light"): void {
  const duration = DURATIONS[style];
  const capacitor = (globalThis as { Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } } }).Capacitor;
  const plugin = capacitor?.Plugins?.Haptics;
  if (plugin?.vibrate) {
    try {
      void plugin.vibrate({ duration });
      observer?.(style, "capacitor");
      return;
    } catch {
      // fall through to the vibration API
    }
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(duration);
      observer?.(style, "vibrate");
      return;
    }
    observer?.(style, "none");
  } catch {
    observer?.(style, "none");
    // no haptics available: the click still works, which is what matters
  }
}
