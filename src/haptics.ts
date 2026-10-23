/**
 * Haptics.
 *
 * Obsidian's mobile shell is a Capacitor app, so the Haptics plugin is the only way to get a real
 * system tap rather than a timed buzz. It is not guaranteed to be exposed, so the function degrades:
 * Capacitor first, the vibration API second, silence third. Nothing here may ever throw into a click
 * handler.
 */

export type HapticStyle = "tick" | "light" | "medium" | "heavy";

const DURATIONS: Record<HapticStyle, number> = { tick: 5, light: 8, medium: 14, heavy: 22 };

interface CapacitorHaptics {
  impact?: (options: { style: string }) => Promise<void>;
}

export function haptic(style: HapticStyle = "light"): void {
  const capacitor = (globalThis as { Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } } }).Capacitor;
  const plugin = capacitor?.Plugins?.Haptics;
  if (plugin?.impact) {
    try {
      void plugin.impact({ style: style.toUpperCase() });
      return;
    } catch {
      // fall through to the vibration API
    }
  }
  try {
    navigator.vibrate?.(DURATIONS[style]);
  } catch {
    // no haptics available: the click still works, which is what matters
  }
}
