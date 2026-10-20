/**
 * Keeps Excalidraw's cached canvas offsets in sync with the real layout.
 *
 * Excalidraw converts every pointer event with
 *   sceneX = (event.clientX - appState.offsetLeft) / zoom - scrollX
 * and only refreshes `offsetLeft` / `offsetTop` when its own container reports a
 * size change (`ResizeObserver`), when the window fires `resize`, or when the
 * nearest scrollable container scrolls — and that last listener only exists
 * when `detectScroll` is enabled, which this plugin disables on purpose.
 *
 * A pure horizontal/vertical *translation* of the view (Obsidian's mobile
 * sidebar drawer, the slide-in animation of a newly opened leaf, the toolbar
 * hiding, and so on) changes neither the size of the container nor the window
 * size, so nothing refreshes the offsets. They stay stale, and every subsequent
 * pointer position is off by the distance the view moved: the selection
 * rectangle is drawn away from the finger, and elements land where the finger
 * is not. That is exactly the mobile "my taps are shifted" bug.
 *
 * `api.refresh()` re-reads `getBoundingClientRect()` and re-applies it, so this
 * helper watches for position drifts and asks Excalidraw to refresh whenever
 * they happen.
 */

interface RefreshableApi {
  refresh: () => void;
}

const DRIFT_TOLERANCE_PX = 0.5;
const SETTLE_WINDOW_MS = 1500;
const SAFETY_CHECK_MS = 1000;

export function keepViewportInSync(api: RefreshableApi, getContainer: () => HTMLElement | null): () => void {
  let lastLeft = Number.NaN;
  let lastTop = Number.NaN;
  let settleFrame = 0;
  let settleUntil = 0;
  let disposed = false;

  const sync = (): void => {
    if (disposed) {
      return;
    }
    const container = getContainer();
    if (!container || !container.isConnected) {
      return;
    }
    const { left, top } = container.getBoundingClientRect();
    if (Number.isNaN(lastLeft)) {
      // First read only records the reference position: Excalidraw has just
      // measured it too, so refreshing here would only trigger a needless save.
      lastLeft = left;
      lastTop = top;
      return;
    }
    if (Math.abs(left - lastLeft) > DRIFT_TOLERANCE_PX || Math.abs(top - lastTop) > DRIFT_TOLERANCE_PX) {
      lastLeft = left;
      lastTop = top;
      api.refresh();
    }
  };

  // Layout animations move the view frame by frame: follow them in real time
  // instead of waiting for the next safety check.
  const settle = (): void => {
    settleUntil = performance.now() + SETTLE_WINDOW_MS;
    if (settleFrame) {
      return;
    }
    const tick = (): void => {
      settleFrame = 0;
      sync();
      if (disposed || performance.now() > settleUntil) {
        return;
      }
      settleFrame = requestAnimationFrame(tick);
    };
    settleFrame = requestAnimationFrame(tick);
  };

  const onChangeDetected = (): void => settle();

  const safetyTimer = window.setInterval(() => {
    if (!document.hidden) {
      sync();
    }
  }, SAFETY_CHECK_MS);

  const viewport = window.visualViewport;
  window.addEventListener("resize", onChangeDetected);
  window.addEventListener("orientationchange", onChangeDetected);
  document.addEventListener("visibilitychange", onChangeDetected);
  // `transitionend` / `animationend` bubble, so listening on the document catches
  // every ancestor animation that could have shifted this view.
  document.addEventListener("transitionend", onChangeDetected, true);
  document.addEventListener("animationend", onChangeDetected, true);
  viewport?.addEventListener("resize", onChangeDetected);
  viewport?.addEventListener("scroll", onChangeDetected);

  sync();
  settle();

  return () => {
    disposed = true;
    window.clearInterval(safetyTimer);
    if (settleFrame) {
      cancelAnimationFrame(settleFrame);
      settleFrame = 0;
    }
    window.removeEventListener("resize", onChangeDetected);
    window.removeEventListener("orientationchange", onChangeDetected);
    document.removeEventListener("visibilitychange", onChangeDetected);
    document.removeEventListener("transitionend", onChangeDetected, true);
    document.removeEventListener("animationend", onChangeDetected, true);
    viewport?.removeEventListener("resize", onChangeDetected);
    viewport?.removeEventListener("scroll", onChangeDetected);
  };
}
