/**
 * Haptics.
 *
 * Two levers exist on Android and only two: the impact styles, which are three fixed waveforms -
 * LIGHT is 50 ms at 43 % amplitude, MEDIUM 43 ms at 71 %, HEAVY 60 ms at 100 % - and vibrate({duration}),
 * which is always full amplitude. Android itself takes an amplitude from 1 to 255, but Capacitor does
 * not pass it through, so the number cannot be chosen: it is one of three, or it is 100 %.
 *
 * A style therefore either picks an amplitude or a length, never both. The sweep wants softness, so it
 * takes LIGHT's 43 % and accepts its 50 ms; a shape taken wants weight, so it takes full amplitude at
 * 32 ms.
 *
 * Nothing here may ever throw into a click handler.
 */

export type HapticStyle = "tick" | "light" | "medium" | "heavy";

type HapticSpec =
  | { impact: "LIGHT" | "MEDIUM" | "HEAVY"; duration: number }
  | { duration: number };

/*
 * `duration` is what the vibration API receives when the impact styles are not available: the same
 * intent expressed with the only lever that path has.
 */
const SPECS: Record<HapticStyle, HapticSpec> = {
  tick: { impact: "LIGHT", duration: 16 },  // soft by amplitude, not by length
  light: { duration: 15 },                  // a button answering a press
  medium: { impact: "MEDIUM", duration: 22 }, // a middle ground, unused for now
  heavy: { duration: 32 }                   // a shape taken: an event, not a beat
};

interface CapacitorHaptics {
  vibrate?: (options: { duration: number }) => Promise<void>;
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
  return `capacitor ${capacitor ? "oui" : "non"} · haptics ${plugin ? "oui" : "non"} · impact ${plugin?.impact ? "oui" : "non"} · vibrate ${vibrate ? "oui" : "non"}`;
}

export function haptic(style: HapticStyle = "light"): void {
  const spec = SPECS[style];
  const capacitor = (globalThis as { Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } } }).Capacitor;
  const plugin = capacitor?.Plugins?.Haptics;
  if (plugin && "impact" in spec && spec.impact && plugin.impact) {
    try {
      void plugin.impact({ style: spec.impact });
      observer?.(style, "capacitor");
      return;
    } catch {
      // fall through: length is better than silence
    }
  }
  if (plugin?.vibrate) {
    try {
      void plugin.vibrate({ duration: spec.duration });
      observer?.(style, "capacitor");
      return;
    } catch {
      // fall through to the vibration API
    }
  }
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(spec.duration);
      observer?.(style, "vibrate");
      return;
    }
    observer?.(style, "none");
  } catch {
    observer?.(style, "none");
    // no haptics available: the click still works, which is what matters
  }
}
