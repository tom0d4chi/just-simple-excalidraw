/**
 * Haptics.
 *
 * Obsidian's mobile shell is a Capacitor app, so the Haptics plugin is the only way to get a real
 * system tap rather than a timed buzz. It is not guaranteed to be exposed, so the function degrades:
 * Capacitor first, the vibration API second, silence third. Nothing here may ever throw into a click
 * handler.
 */

export type HapticStyle = "tick" | "light" | "medium" | "heavy";

/*
 * Durations are for the vibration API, which has no amplitude: on Android a pulse under ~10 ms is
 * barely perceptible whatever the phone, so the tick sits well above that. The Capacitor impact is the
 * only lever on strength, and LIGHT is a whisper on most phones.
 */
const DURATIONS: Record<HapticStyle, number> = { tick: 16, light: 10, medium: 18, heavy: 26 };

/*
 * Capacitor only knows three impacts. A tick is not a fourth kind - it is the lightest one - and
 * "TICK" would be rejected by the plugin, silently dropping every tap on a phone.
 */
const IMPACTS: Record<HapticStyle, string> = { tick: "MEDIUM", light: "LIGHT", medium: "MEDIUM", heavy: "HEAVY" };

interface CapacitorHaptics {
  impact?: (options: { style: string }) => Promise<void>;
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
  return `capacitor ${capacitor ? "oui" : "non"} · haptics ${plugin?.impact ? "oui" : "non"} · vibrate ${vibrate ? "oui" : "non"}`;
}

export function haptic(style: HapticStyle = "light"): void {
  const capacitor = (globalThis as { Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } } }).Capacitor;
  const plugin = capacitor?.Plugins?.Haptics;
  if (plugin?.impact) {
    try {
      void plugin.impact({ style: IMPACTS[style] });
      observer?.(style, "capacitor");
      return;
    } catch {
      // fall through to the vibration API
    }
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(DURATIONS[style]);
      observer?.(style, "vibrate");
      return;
    }
    observer?.(style, "none");
  } catch {
    observer?.(style, "none");
    // no haptics available: the click still works, which is what matters
  }
}
