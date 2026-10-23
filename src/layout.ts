/**
 * Obsidian's mobile navbar floats over the bottom of the view, so the drawing
 * area the eye reads is the screen minus that bar and the gap under it. A column
 * centred on the raw view therefore looks slightly low. Measure the bar and
 * publish its footprint as a CSS variable, so the column can centre on what is
 * actually usable — and keep it current when the bar changes height, hides
 * itself or the window rotates.
 *
 * Everything here degrades to a no-op: the plugin also renders in environments
 * without a DOM (the test harness), and a missing observer must never break it.
 */
export function trackBottomUiInset(root: HTMLElement): () => void {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof document.querySelector !== "function" ||
    !document.body
  ) {
    return () => undefined;
  }

  let observer: ResizeObserver | null = null;

  const update = (): void => {
    const bar = document.querySelector<HTMLElement>(".mobile-navbar");
    const rect = bar?.getBoundingClientRect();
    const inset = rect ? Math.max(0, window.innerHeight - rect.top) : 0;
    root.style.setProperty("--jse-bottom-ui", `${Math.round(inset)}px`);
    /*
     * The space the bar leaves under itself is the app's own idea of a comfortable margin, so the
     * column takes it as its inset on both axes: the same air below the bar as beside it.
     */
    if (rect) {
      root.style.setProperty("--jse-nav-gap", `${Math.round(Math.max(0, window.innerHeight - rect.bottom))}px`);
    } else {
      root.style.removeProperty("--jse-nav-gap");
    }
    /*
     * The icons are the platform's size, not a guess: the column reads the width of an icon in the
     * navbar and scales its own buttons from it, so the two bars look drawn by the same hand.
     */
    const icon = bar?.querySelector<SVGElement>(".svg-icon, svg");
    const iconWidth = icon?.getBoundingClientRect().width ?? 0;
    if (iconWidth > 0) {
      root.style.setProperty("--jse-nav-icon", `${Math.round(iconWidth)}px`);
    } else {
      root.style.removeProperty("--jse-nav-icon");
    }
  };

  const watch = (): void => {
    if (typeof ResizeObserver !== "function") {
      return;
    }
    const bar = document.querySelector<HTMLElement>(".mobile-navbar");
    if (!bar) {
      return;
    }
    observer?.disconnect();
    observer = new ResizeObserver(update);
    observer.observe(bar);
  };

  update();
  watch();

  // The bar can be mounted after the view, and it can be swapped on rotation.
  const retries = [150, 600, 1500].map((delay) => window.setTimeout(() => {
    watch();
    update();
  }, delay));

  const onResize = (): void => {
    watch();
    update();
  };

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  const mutations = typeof MutationObserver === "function" ? new MutationObserver(onResize) : null;
  mutations?.observe(document.body, { childList: true, attributes: true, attributeFilter: ["class", "style"] });

  return () => {
    retries.forEach((id) => window.clearTimeout(id));
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    observer?.disconnect();
    mutations?.disconnect();
  };
}
