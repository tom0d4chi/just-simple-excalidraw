import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/*
 * All the pointer behaviour of the sheet lives here, in one place:
 *  - a tap on empty paper drops the selection and hands the sheet back to the hand;
 *  - a tap on an element selects it and arms Excalidraw's selection tool quietly,
 *    so a drag moves the element;
 *  - a drag on empty paper pans — unless the cursor was armed by its button, in
 *    which case a marquee is drawn instead;
 *  - a second finger cancels any marquee and blocks it until every finger is up.
 *
 * The mobile harness imports this too, so what is tested in the browser is the code
 * that ships, not a copy of it.
 */
export interface PreviewBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PreviewRect {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/*
 * Screen rectangles for the elements a marquee has caught. Kept pure and exported
 * so the alignment can be tested without a browser: the rectangles depend on the
 * canvas origin, the scroll and the zoom, never on where the box is.
 */
export function selectionPreviewRects(
  elements: readonly { id: string; type: string; x: number; y: number; width: number; height: number; isDeleted?: boolean }[],
  view: { scrollX: number; scrollY: number; zoom: number; originX: number; originY: number; hostX?: number; hostY?: number },
  box: PreviewBox
): PreviewRect[] {
  const zoom = view.zoom || 1;
  // The box arrives in client coordinates; the rectangles are in container ones.
  const boxLeft = box.left - (view.hostX ?? 0);
  const boxTop = box.top - (view.hostY ?? 0);
  const boxRight = box.right - (view.hostX ?? 0);
  const boxBottom = box.bottom - (view.hostY ?? 0);
  return elements.flatMap((element) => {
    if (element.isDeleted || element.type === "selection") {
      return [];
    }
    const left = view.originX + (element.x + view.scrollX) * zoom;
    const top = view.originY + (element.y + view.scrollY) * zoom;
    const width = element.width * zoom;
    const height = element.height * zoom;
    const caught = left < boxRight && left + width > boxLeft && top < boxBottom && top + height > boxTop;
    return caught ? [{ id: element.id, left, top, width, height }] : [];
  });
}

export interface InteractionOptions {
  host: HTMLElement;
  api: ExcalidrawImperativeAPI;
  /** Whether the cursor button is armed (multi-select asked for explicitly). */
  armed: () => boolean;
  /** Arms or disarms the cursor button. */
  setArmed: (armed: boolean) => void;
  /** Lets the owner cancel a marquee in progress (used on a tool change). */
  onMarqueeCancel?: (cancel: (() => void) | null) => void;
}

export interface InteractionHandle {
  detach: () => void;
}

export function attachInteraction(options: InteractionOptions): InteractionHandle {
  const { host, api, armed, setArmed } = options;
  const elementUnder = (event: PointerEvent): string | null => {
    const state = api.getAppState();
    const bounds = host.getBoundingClientRect();
    const zoom = state.zoom.value || 1;
    const sceneX = (event.clientX - bounds.left) / zoom - state.scrollX;
    const sceneY = (event.clientY - bounds.top) / zoom - state.scrollY;
    const hit = [...api.getSceneElements()].reverse().find((element) => (
      !element.isDeleted &&
      sceneX >= element.x &&
      sceneX <= element.x + element.width &&
      sceneY >= element.y &&
      sceneY <= element.y + element.height
    ));
    return hit ? hit.id : null;
  };

  let tap: { pointerId: number; x: number; y: number; at: number } | null = null;
  const fingers = new Set<number>();
  let multiTouch = false;

  const onDown = (event: PointerEvent): void => {
    const state = api.getAppState();
    const id = elementUnder(event);
    /*
     * Touching empty paper drops the selection, whatever the tool is: the hand
     * ignores taps, so an undo that brings a selection back would otherwise leave
     * it stuck with no way to let go of it. Deferred, because Excalidraw's own
     * pointerdown writes its snapshot of the selection back over this listener.
     */
    if (!id && Object.keys(state.selectedElementIds ?? {}).length > 0) {
      window.setTimeout(() => {
        if (Object.keys(api.getAppState().selectedElementIds ?? {}).length > 0) {
          api.updateScene({ appState: { selectedElementIds: {} } });
        }
      }, 0);
    }
    if (event.pointerType === "mouse") {
      return;
    }
    /*
     * Only the first finger can be a tap: the second one is part of a pan or a
     * pinch, and a stationary second finger must never be read as "tap on empty
     * paper" (which would drop the cursor mode mid-gesture).
     */
    if (fingers.size > 0) {
      tap = null;
      return;
    }
    const tool = state.activeTool.type;
    if (tool !== "hand" && tool !== "selection") {
      return;
    }
    tap = id ? null : { pointerId: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now() };
    if (id) {
      if (!Object.hasOwn(state.selectedElementIds ?? {}, id)) {
        api.updateScene({ appState: { selectedElementIds: { [id]: true } } });
      }
      if (tool !== "selection") {
        api.setActiveTool({ type: "selection", locked: false });
      }
      return;
    }
    if (tool === "selection" && !armed()) {
      api.setActiveTool({ type: "hand", locked: false });
    }
  };

  /* A tap on empty paper leaves the cursor mode, however it was armed. */
  const onUp = (event: PointerEvent): void => {
    const origin = tap;
    tap = null;
    if (!origin || origin.pointerId !== event.pointerId || multiTouch || fingers.size > 1) {
      return;
    }
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10 || Date.now() - origin.at > 350) {
      return;
    }
    window.setTimeout(() => {
      const state = api.getAppState();
      if (state.activeTool.type === "selection" && Object.keys(state.selectedElementIds ?? {}).length === 0) {
        setArmed(false);
        api.setActiveTool({ type: "hand", locked: false });
      }
    }, 0);
  };

  let interactiveCanvas: HTMLElement | null = null;
  let boxStart: { x: number; y: number; pointerId: number } | null = null;
  let box: HTMLDivElement | null = null;
  // Elements already caught by the growing marquee are tinted in the accent colour,
  // as a preview of what the release will select. It is an overlay: the shapes
  // themselves are never touched, so no accent colour can end up in the file.
  const preview = new Map<string, HTMLElement>();
  let previewLayer: HTMLDivElement | null = null;
  const layer = (): HTMLDivElement => {
    if (!previewLayer || !previewLayer.isConnected) {
      previewLayer = document.createElement("div");
      previewLayer.className = "jse-preselect-layer";
      host.appendChild(previewLayer);
    }
    return previewLayer;
  };

  const drawBox = (event: PointerEvent): void => {
    if (!boxStart || event.pointerId !== boxStart.pointerId || !box) {
      return;
    }
    const bounds = host.getBoundingClientRect();
    const left = Math.min(boxStart.x, event.clientX) - bounds.left;
    const top = Math.min(boxStart.y, event.clientY) - bounds.top;
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${Math.abs(event.clientX - boxStart.x)}px`;
    box.style.height = `${Math.abs(event.clientY - boxStart.y)}px`;
    const rect = box.querySelector("rect");
    if (rect) {
      rect.setAttribute("width", `${Math.max(0, Math.abs(event.clientX - boxStart.x) - 2)}`);
      rect.setAttribute("height", `${Math.max(0, Math.abs(event.clientY - boxStart.y) - 2)}`);
    }
    updatePreview(event);
  };

  /* Marquee in client coordinates, elements in scene coordinates. */
  const updatePreview = (event: PointerEvent): void => {
    if (!boxStart) {
      return;
    }
    const state = api.getAppState();
    /*
     * The overlay lives in the container, but Excalidraw draws from the canvas
     * origin: measure that canvas, not the container, or the ghosts drift by the
     * chrome above the sheet.
     */
    const hostRect = host.getBoundingClientRect();
    const canvas = host.querySelector<HTMLElement>(".excalidraw__canvas.interactive")
      ?? host.querySelector<HTMLElement>(".excalidraw__canvas");
    const origin = canvas ? canvas.getBoundingClientRect() : hostRect;
    const originX = origin.left - hostRect.left;
    const originY = origin.top - hostRect.top;
    const zoom = state.zoom.value || 1;
    const left = Math.min(boxStart.x, event.clientX);
    const top = Math.min(boxStart.y, event.clientY);
    const right = Math.max(boxStart.x, event.clientX);
    const bottom = Math.max(boxStart.y, event.clientY);

    const live = selectionPreviewRects(
      api.getSceneElements(),
      { scrollX: state.scrollX, scrollY: state.scrollY, zoom, originX, originY, hostX: hostRect.left, hostY: hostRect.top },
      { left, top, right, bottom }
    );

    const seen = new Set(live.map((element) => element.id));
    for (const [id, node] of preview) {
      if (!seen.has(id)) {
        node.remove();
        preview.delete(id);
      }
    }
    for (const rect of live) {
      let node = preview.get(rect.id);
      if (!node) {
        node = document.createElement("div");
        node.className = "jse-preselect";
        // In a clipping layer of the container, never inside the marquee: nested
        // there, the box's own position would be added to every ghost and they
        // would follow the finger. The layer cannot grow the page either.
        layer().appendChild(node);
        preview.set(rect.id, node);
      }
      node.style.left = `${rect.left}px`;
      node.style.top = `${rect.top}px`;
      node.style.width = `${rect.width}px`;
      node.style.height = `${rect.height}px`;
    }
  };

  const clearPreview = (): void => {
    for (const node of preview.values()) {
      node.remove();
    }
    preview.clear();
    previewLayer?.remove();
    previewLayer = null;
  };

  const startBox = (event: PointerEvent): void => {
    const state = api.getAppState();
    if (state.activeTool.type !== "selection" || !armed() || elementUnder(event)) {
      return;
    }
    boxStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    interactiveCanvas = host.querySelector<HTMLElement>(".excalidraw__canvas.interactive");
    if (interactiveCanvas) {
      interactiveCanvas.style.opacity = "0";
    }
    box = document.createElement("div");
    box.className = "jse-marquee";
    // An SVG rectangle, so the dashes follow the rounded corners (a border cannot
    // be animated, and gradient sides cannot turn a corner).
    box.innerHTML = '<svg class="jse-marquee__svg"><rect class="jse-marquee__rect" x="1" y="1" rx="6" ry="6"/></svg>';
    host.appendChild(box);
    drawBox(event);
  };

  const clearBox = (): void => {
    clearPreview();
    boxStart = null;
    box?.remove();
    box = null;
    if (interactiveCanvas) {
      interactiveCanvas.style.removeProperty("opacity");
      interactiveCanvas = null;
    }
  };

  const endBox = (event: PointerEvent): void => {
    if (!boxStart || event.pointerId !== boxStart.pointerId) {
      return;
    }
    clearBox();
  };

  const onMove = (event: PointerEvent): void => drawBox(event);

  const onDownBox = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      return;
    }
    fingers.add(event.pointerId);
    /*
     * A second finger is a pan or a pinch, never a selection: the marquee is
     * dropped and stays dropped until every finger is up.
     */
    if (boxStart && boxStart.pointerId !== event.pointerId) {
      multiTouch = true;
      clearBox();
      return;
    }
    if (!multiTouch) {
      startBox(event);
    }
  };

  const onUpBox = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      return;
    }
    fingers.delete(event.pointerId);
    if (fingers.size === 0) {
      multiTouch = false;
    }
    endBox(event);
  };

  options.onMarqueeCancel?.(clearBox);

  host.addEventListener("pointerdown", onDown, true);
  host.addEventListener("pointerup", onUp, true);
  host.addEventListener("pointerdown", onDownBox, true);
  host.addEventListener("pointermove", onMove, true);
  host.addEventListener("pointerup", onUpBox, true);
  host.addEventListener("pointercancel", onUpBox, true);

  return {
    detach: () => {
      host.removeEventListener("pointerdown", onDown, true);
      host.removeEventListener("pointerup", onUp, true);
      host.removeEventListener("pointerdown", onDownBox, true);
      host.removeEventListener("pointermove", onMove, true);
      host.removeEventListener("pointerup", onUpBox, true);
      host.removeEventListener("pointercancel", onUpBox, true);
      clearBox();
      options.onMarqueeCancel?.(null);
    }
  };
}
