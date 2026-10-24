import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { snapClient, snapValue, type SnapGesture } from "./snap";

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
/** Pixels of travel per tap: the marquee's tempo is the speed of the hand divided by this. */
const MARQUEE_TICK_STEP = 32;
/** Shortest gap between two taps: the platform merges anything closer into one buzz. */
const MARQUEE_TICK_FLOOR_MS = 26;

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
    /*
     * Excalidraw's marquee only takes what it encloses whole, so a shape merely
     * brushing the box must not be tinted: the preview has to promise exactly what
     * the release will do.
     */
    const caught = left >= boxLeft && left + width <= boxRight && top >= boxTop && top + height <= boxBottom;
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
  /**
   * How many taps the marquee owes after travelling this far: one every MARQUEE_TICK_STEP pixels, so
   * the tempo follows the speed of the hand instead of the content of the drawing. A slow sweep
   * crackles slowly, a fast one rattles.
   */
  onMarqueeTick?: (ticks: number) => void;
  /** How many shapes the box just took: an arrival, heavier than the ticking of the sweep. */
  onMarqueeCatch?: (caught: number) => void;
  /**
   * A preview is writing to the scene: the owner must not save those writes. They are undone before
   * the gesture ends, and the file is only ever written with the values it already had.
   */
  onPreviewChange?: (active: boolean) => void;
  /** Lets the owner cancel a marquee in progress (used on a tool change). */
  onMarqueeCancel?: (cancel: (() => void) | null) => void;
  /**
   * Called after a gesture, with the versionNonce each element had when it started:
   * whatever changed during the gesture is the set a snap has to move.
   */
  onGestureEnd?: (before: ReadonlyMap<string, number>) => void;
  /** Live snapping of the finger to the dot lattice, when the setting asks for it. */
  snapping?: () => number;
  /**
   * A second tap on empty paper, close in time and place to the first. Returning true
   * swallows the event, so Excalidraw does not turn it into a text element.
   */
  onDoubleTap?: (scene: { x: number; y: number }) => boolean;
  /**
   * Every two-finger gesture, with what was measured: the only way to know why a hand does or does
   * not reach the gesture on a device we cannot see.
   */
  onPinchSample?: (sample: {
    ms: number;
    spread: number;
    ratio: number;
    travel: number;
    drift: number;
    moves: number;
  }) => void;
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

  let beforeGesture = new Map<string, number>();
  let lastTap: { at: number; x: number; y: number } | null = null;
  /*
   * A second tap is ambiguous until the finger moves: it is either a double tap (zoom) or the start
   * of a double-tap drag (marquee). Nothing is decided on the way down - the zoom waits for the
   * finger to lift without travelling.
   */
  let pendingDouble: { scene: { x: number; y: number }; x: number; y: number; pointerId: number } | null = null;
  let doubleArmed = false;
  let pointerSnap: SnapGesture | null = null;
  let resizeGrab = false;
  /* Touch fingers are fat; Excalidraw's handles are 8 px. Reach for the nearest one
     from further away by moving the pointer onto its centre. */
  const HANDLE_REACH = 22;
  const DRAFTING = new Set(["rectangle", "diamond", "ellipse", "line", "arrow", "text", "frame"]);

  /* Rewrites the coordinates Excalidraw is about to read, so the snap is live. */
  const applySnap = (event: PointerEvent, gesture: SnapGesture): void => {
    const snapped = snapClient(event, gesture);
    Object.defineProperty(event, "clientX", { value: snapped.x, configurable: true });
    Object.defineProperty(event, "clientY", { value: snapped.y, configurable: true });
  };

  const scenePoint = (event: PointerEvent): { x: number; y: number; zoom: number } => {
    const state = api.getAppState();
    const bounds = host.getBoundingClientRect();
    const zoom = state.zoom.value || 1;
    return {
      x: (event.clientX - bounds.left) / zoom - state.scrollX,
      y: (event.clientY - bounds.top) / zoom - state.scrollY,
      zoom
    };
  };

  const onDownHandles = (event: PointerEvent): void => {
    resizeGrab = false;
    if (event.pointerType === "mouse") {
      return;
    }
    const state = api.getAppState();
    const ids = Object.keys(state.selectedElementIds ?? {});
    if (ids.length === 0 || DRAFTING.has(state.activeTool.type)) {
      return;
    }
    const selection = api.getSceneElements().filter((element) => (
      !element.isDeleted && Object.hasOwn(state.selectedElementIds ?? {}, element.id)
    ));
    if (selection.length === 0) {
      return;
    }
    const bounds = host.getBoundingClientRect();
    const zoom = state.zoom.value || 1;
    const left = bounds.left + (Math.min(...selection.map((e) => e.x)) + state.scrollX) * zoom;
    const top = bounds.top + (Math.min(...selection.map((e) => e.y)) + state.scrollY) * zoom;
    const right = bounds.left + (Math.max(...selection.map((e) => e.x + e.width)) + state.scrollX) * zoom;
    const bottom = bounds.top + (Math.max(...selection.map((e) => e.y + e.height)) + state.scrollY) * zoom;
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;
    const handles = [
      [left, top], [midX, top], [right, top], [right, midY],
      [right, bottom], [midX, bottom], [left, bottom], [left, midY]
    ];
    let best: number[] | null = null;
    let bestDistance = Infinity;
    for (const handle of handles) {
      const distance = Math.hypot(event.clientX - handle[0], event.clientY - handle[1]);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = handle;
      }
    }
    if (!best || bestDistance > HANDLE_REACH) {
      return;
    }
    Object.defineProperty(event, "clientX", { value: best[0], configurable: true });
    Object.defineProperty(event, "clientY", { value: best[1], configurable: true });
    resizeGrab = true;
  };

  /* Called first in the capture phase, before the gesture handlers below. */
  const onDownSnap = (event: PointerEvent): void => {
    pointerSnap = null;
    const step = options.snapping?.() ?? 0;
    // A resize is its own gesture: snapping the finger would fight the handle.
    if (!step || resizeGrab) {
      return;
    }
    const state = api.getAppState();
    const tool = state.activeTool.type;
    const point = scenePoint(event);

    if (DRAFTING.has(tool)) {
      // A new shape starts on a dot: the first corner is snapped as well.
      const anchorX = snapValue(point.x, step);
      const anchorY = snapValue(point.y, step);
      const bounds = host.getBoundingClientRect();
      const originX = bounds.left + (anchorX + state.scrollX) * point.zoom;
      const originY = bounds.top + (anchorY + state.scrollY) * point.zoom;
      pointerSnap = { anchorX, anchorY, originX, originY, zoom: point.zoom, step };
      applySnap(event, pointerSnap);
      return;
    }

    /*
     * A drag that starts on a shape moves it — with the hand tool too, since the
     * gesture handler below selects it and hands over to the selection tool. A pan on
     * empty paper keeps its raw coordinates.
     */
    const hitId = elementUnder(event);
    if (!hitId) {
      return;
    }
    const selected = Object.keys(state.selectedElementIds ?? {}).length > 0
      ? api.getSceneElements().filter((element) => Object.hasOwn(state.selectedElementIds ?? {}, element.id) && !element.isDeleted)
      : [];
    const moving = selected.length > 0
      ? selected
      : api.getSceneElements().filter((element) => element.id === hitId && !element.isDeleted);
    if (moving.length === 0) {
      return;
    }
    // Dragging a selection: the block's own corner is what lands on the lattice.
    pointerSnap = {
      anchorX: Math.min(...moving.map((element) => element.x)),
      anchorY: Math.min(...moving.map((element) => element.y)),
      originX: event.clientX,
      originY: event.clientY,
      zoom: point.zoom,
      step
    };
  };

  const onMoveSnap = (event: PointerEvent): void => {
    if (pointerSnap && fingers.size < 2) {
      applySnap(event, pointerSnap);
    }
  };

  /*
   * The light pinch, tracked on its own: both fingers, the distance between them and the middle of
   * the pair. It only ever observes - Excalidraw keeps its own zoom - and speaks once, on release.
   */
  const pinchPoints = new Map<number, { x: number; y: number }>();
  const pinch = { active: false, from: 0, at: 0, cx: 0, cy: 0, ratio: 1, travel: 0, drift: 0, moves: 0 };

  const pinchMeasure = (): { distance: number; cx: number; cy: number } | null => {
    if (pinchPoints.size < 2) {
      return null;
    }
    const [a, b] = [...pinchPoints.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2
    };
  };

  const onPinchDown = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      return;
    }
    pinchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinchPoints.size !== 2) {
      return;
    }
    const measured = pinchMeasure();
    if (!measured) {
      return;
    }
    pinch.active = true;
    pinch.from = measured.distance;
    pinch.at = Date.now();
    pinch.cx = measured.cx;
    pinch.cy = measured.cy;
    pinch.ratio = 1;
    pinch.travel = 0;
    pinch.drift = 0;
    pinch.moves = 0;
  };

  const onPinchMove = (event: PointerEvent): void => {
    if (!pinchPoints.has(event.pointerId)) {
      return;
    }
    pinchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!pinch.active) {
      return;
    }
    const measured = pinchMeasure();
    if (!measured || !pinch.from) {
      return;
    }
    pinch.moves += 1;
    pinch.ratio = measured.distance / pinch.from;
    pinch.travel = Math.abs(measured.distance - pinch.from);
    pinch.drift = Math.hypot(measured.cx - pinch.cx, measured.cy - pinch.cy);
  };

  const onPinchUp = (event: PointerEvent): void => {
    if (!pinchPoints.has(event.pointerId)) {
      return;
    }
    pinchPoints.delete(event.pointerId);
    if (!pinch.active || pinchPoints.size >= 2) {
      return;
    }
    const sample = {
      ms: Date.now() - pinch.at,
      spread: Math.round(pinch.from),
      ratio: Number(pinch.ratio.toFixed(3)),
      travel: Math.round(pinch.travel),
      drift: Math.round(pinch.drift),
      moves: pinch.moves
    };
    pinch.active = false;
    pinch.from = 0;
    options.onPinchSample?.(sample);
  };

  const onDown = (event: PointerEvent): void => {
    const state = api.getAppState();
    beforeGesture = new Map(api.getSceneElements().map((element) => [element.id, element.versionNonce]));
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
          api.updateScene({
            appState: { selectedElementIds: {} },
            // Moving the selection is not an edit: it must not become an undo step. Excalidraw spells
            // its capture actions "NEVER" / "IMMEDIATELY"; importing the enum would drag the whole
            // library into the single-module test harness.
            captureUpdate: "NEVER" as never
          });
        }
      }, 0);
    }
    /*
     * Two taps on empty paper, close in time and place, are a zoom toggle: the second
     * one is swallowed so Excalidraw cannot turn it into a text element.
     */
    /* A second finger is not a second tap: without this, every two-finger pinch reads as a double
       tap on the way down and zooms in before the fingers have moved. */
    if (!id && event.pointerType !== "mouse" && event.isPrimary !== false && options.onDoubleTap) {
      const now = Date.now();
      const near = lastTap && now - lastTap.at < 320
        && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30;
      if (near) {
        lastTap = null;
        const point = scenePoint(event);
        pendingDouble = { scene: { x: point.x, y: point.y }, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        // Swallowed now: Excalidraw must not turn the second tap into a text element while we wait.
        event.preventDefault();
        event.stopPropagation();
        return;
      } else {
        lastTap = { at: now, x: event.clientX, y: event.clientY };
      }
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
        api.updateScene({
          appState: { selectedElementIds: { [id]: true } },
          captureUpdate: "NEVER" as never
        });
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
    window.setTimeout(() => { pointerSnap = null; }, 0);
    if (options.onGestureEnd) {
      const before = beforeGesture;
      // Deferred: Excalidraw commits the gesture in its own pointerup handling.
      window.setTimeout(() => options.onGestureEnd?.(before), 0);
    }
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
  /*
   * What the marquee has caught is shown by tinting the shapes themselves, not by drawing boxes over
   * them: an added box says "look at this rectangle", a changed shape says "this one is being taken".
   * Every element touched keeps its original values here, and they are put back the moment the
   * gesture ends - whatever ends it - so no accent colour can ever reach the file.
   */
  const tinted = new Map<string, {
    strokeColor: string;
    backgroundColor: string;
    fillStyle: string;
    opacity: number;
    version: number;
    versionNonce: number;
  }>();
  const accent = (): string => {
    const value = typeof getComputedStyle === "function"
      ? getComputedStyle(document.body).getPropertyValue("--interactive-accent").trim()
      : "";
    return /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#6965db";
  };
  /* Shapes have an area to wash; a line has only a stroke; an image has neither. */
  const hasArea = (type: string): boolean => (
    type === "rectangle" || type === "diamond" || type === "ellipse"
  );
  const hasStroke = (type: string): boolean => (
    hasArea(type) || type === "line" || type === "arrow" || type === "freedraw" || type === "text"
  );
  /* The accent at 28 %, so the wash reads as a highlighter rather than a new fill. */
  const wash = (colour: string): string => {
    const hex = colour.replace("#", "");
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const value = parseInt(full.slice(0, 6), 16);
    if (Number.isNaN(value)) {
      return "rgba(105, 101, 219, 0.28)";
    }
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, 0.28)`;
  };
  /*
   * The tick is owed for distance, not for content: what the hand feels is how fast the box is
   * travelling, and a fixed step makes the tempo exactly proportional to that speed.
   */
  let tickAnchorX = 0;
  let tickAnchorY = 0;
  let tickDebt = 0;
  let lastTickAt = 0;
  // What the gesture has already taken from the drawing: an arrival is announced once.
  let caught = new Set<string>();
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
    /*
     * A fast flick arrives as one event with fifteen points inside it; the browser keeps them in
     * getCoalescedEvents, and counting only the endpoints would make a fast sweep tick slower than a
     * slow one - the opposite of what the hand expects.
     */
    const points = typeof event.getCoalescedEvents === "function" && event.getCoalescedEvents().length > 0
      ? event.getCoalescedEvents()
      : [event];
    for (const point of points) {
      const travelled = Math.hypot(point.clientX - tickAnchorX, point.clientY - tickAnchorY);
      const now = Date.now();
      tickDebt += travelled;
      tickAnchorX = point.clientX;
      tickAnchorY = point.clientY;
      if (tickDebt >= MARQUEE_TICK_STEP) {
        /*
         * A ceiling at about thirty taps a second, where the platform merges them into one buzz. The
         * debt stays put, so nothing is lost: it is spent as soon as the hand allows.
         */
        if (now - lastTickAt >= MARQUEE_TICK_FLOOR_MS) {
          lastTickAt = now;
          tickDebt -= MARQUEE_TICK_STEP;
          options.onMarqueeTick?.(1);
        }
      }
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
    let arrived = 0;
    for (const id of seen) {
      if (!caught.has(id)) {
        arrived += 1;
      }
    }
    /*
     * The set is replaced even when nothing arrived: a shape the box leaves has to be forgotten, or a
     * shape taken again would be silent - the arrival is an event, and it is owed every time.
     */
    caught = seen;
    if (arrived > 0) {
      options.onMarqueeCatch?.(arrived);
    }
    /* Only when the set of caught shapes changed: the tint is a scene write, not a paint. */
    let changed = false;
    for (const id of seen) {
      if (!tinted.has(id)) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      for (const id of tinted.keys()) {
        if (!seen.has(id)) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      applyTint(seen);
    }
  };

  /*
   * The tint, and the way back. Both go through updateScene marked "never", so the file's history
   * never learns about a gesture that changed nothing in the end.
   */
  const applyTint = (caughtIds: Set<string>): void => {
    const elements = api.getSceneElements();
    const colour = accent();
    const next = elements.map((element) => {
      const isCaught = caughtIds.has(element.id);
      const saved = tinted.get(element.id);
      if (isCaught) {
        if (!saved) {
          tinted.set(element.id, {
            strokeColor: element.strokeColor,
            backgroundColor: element.backgroundColor,
            fillStyle: element.fillStyle,
            opacity: element.opacity,
            version: element.version,
            versionNonce: element.versionNonce
          });
        }
        const stamp = Date.now() % 100000;
        if (hasArea(element.type)) {
          return {
            ...element,
            strokeColor: colour,
            backgroundColor: wash(colour),
            fillStyle: "solid",
            version: element.version + 1,
            versionNonce: stamp
          };
        }
        return hasStroke(element.type)
          ? { ...element, strokeColor: colour, version: element.version + 1, versionNonce: stamp }
          : { ...element, opacity: 45, version: element.version + 1, versionNonce: stamp };
      }
      if (!saved) {
        return element;
      }
      tinted.delete(element.id);
      return {
        ...element,
        strokeColor: saved.strokeColor,
        backgroundColor: saved.backgroundColor,
        fillStyle: saved.fillStyle as never,
        opacity: saved.opacity,
        version: saved.version,
        versionNonce: saved.versionNonce
      };
    });
    options.onPreviewChange?.(tinted.size > 0);
    api.updateScene({ elements: next as never, captureUpdate: "NEVER" as never });
  };

  const restoreTint = (): void => {
    if (tinted.size === 0) {
      return;
    }
    const elements = api.getSceneElements().map((element) => {
      const saved = tinted.get(element.id);
      if (!saved) {
        return element;
      }
      return {
        ...element,
        strokeColor: saved.strokeColor,
        backgroundColor: saved.backgroundColor,
        fillStyle: saved.fillStyle as never,
        opacity: saved.opacity,
        version: saved.version,
        versionNonce: saved.versionNonce
      };
    });
    tinted.clear();
    api.updateScene({ elements: elements as never, captureUpdate: "NEVER" as never });
    options.onPreviewChange?.(false);
  };

  const clearPreview = (): void => {
    restoreTint();
  };

  const startBox = (
    event: PointerEvent,
    forced = false,
    origin: { x: number; y: number } = { x: event.clientX, y: event.clientY }
  ): void => {
    tickAnchorX = event.clientX;
    tickAnchorY = event.clientY;
    tickDebt = 0;
    lastTickAt = 0;
    caught = new Set<string>();
    const state = api.getAppState();
    /*
     * Forced, the gesture brings its own tool: a double-tap drag asks for a selection while the hand
     * tool is still the active one, and the state has not caught up yet.
     */
    if (!forced && (state.activeTool.type !== "selection" || !armed() || elementUnder(event))) {
      return;
    }
    boxStart = { x: origin.x, y: origin.y, pointerId: event.pointerId };
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
    const wasBox = Boolean(boxStart && event.pointerId === boxStart.pointerId);
    const ids = wasBox ? [...caught] : [];
    const forced = doubleArmed;
    if (wasBox) {
      clearBox();
    }
    if (!wasBox && !forced) {
      return;
    }
    doubleArmed = false;
    setArmed(false);
    const selection = Object.fromEntries(ids.map((id) => [id, true]));
    /*
     * A marquee is a gesture, not a mode: the sheet goes back to the hand the moment it is released,
     * so the next drag pans instead of drawing another box from nowhere.
     *
     * The order matters and it is not the obvious one: switching tools drops the selection, so the
     * tool returns first and the selection is written after it. Deferred by a tick, so Excalidraw's
     * own pointerup has finished speaking before the last word.
     */
    window.setTimeout(() => {
      if (api.getAppState().activeTool.type === "selection") {
        api.setActiveTool({ type: "hand", locked: false });
      }
      if (Object.keys(selection).length > 0) {
        api.updateScene({
          appState: { selectedElementIds: selection as never },
          captureUpdate: "NEVER" as never
        });
      }
    }, 0);
  };

  const onDownBox = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      return;
    }
    fingers.add(event.pointerId);
    /*
     * A second finger is a pan or a pinch, never a selection: the marquee is dropped and stays
     * dropped until every finger is up.
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

  const onMove = (event: PointerEvent): void => {
    /*
     * A double-tap drag is ours from the moment it becomes a drag: the hand tool must not pan the
     * sheet under the box, or the shapes would slide out of it while it is being drawn.
     */
    if (doubleArmed) {
      event.stopPropagation();
    }
    if (pendingDouble && event.pointerId === pendingDouble.pointerId) {
      const moved = Math.hypot(event.clientX - pendingDouble.x, event.clientY - pendingDouble.y);
      if (moved > 10) {
        const overElement = elementUnder(event);
        /* The box starts where the finger landed, not where it has already travelled to. */
        const origin = { x: pendingDouble.x, y: pendingDouble.y };
        pendingDouble = null;
        if (overElement) {
          return;
        }
        doubleArmed = true;
        // This very event must not reach Excalidraw either, or the sheet pans under the box.
        event.stopPropagation();
        startBox(event, true, origin);
        return;
      }
    }
    drawBox(event);
  };

  /* A second tap that never travelled is the old double tap: it zooms. */
  const onUpDouble = (event: PointerEvent): void => {
    if (!pendingDouble || event.pointerId !== pendingDouble.pointerId) {
      return;
    }
    const { scene } = pendingDouble;
    pendingDouble = null;
    options.onDoubleTap?.({ x: scene.x, y: scene.y });
  };

  const onUpBox = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      return;
    }
    /* The drag belonged to us from its first pixel: Excalidraw must not read it as a pan. */
    if (doubleArmed) {
      event.stopPropagation();
    }
    fingers.delete(event.pointerId);
    if (fingers.size === 0) {
      multiTouch = false;
    }
    endBox(event);
  };

  options.onMarqueeCancel?.(clearBox);

  host.addEventListener("pointerdown", onDownHandles, true);
  host.addEventListener("pointerdown", onDownSnap, true);
  host.addEventListener("pointermove", onMoveSnap, true);
  host.addEventListener("pointerup", onMoveSnap, true);
  host.addEventListener("pointerdown", onDown, true);
  host.addEventListener("pointerup", onUp, true);
  host.addEventListener("pointerdown", onDownBox, true);
  host.addEventListener("pointermove", onMove, true);
  host.addEventListener("pointerup", onUpBox, true);
  host.addEventListener("pointercancel", onUpBox, true);
  host.addEventListener("pointerdown", onPinchDown, true);
  host.addEventListener("pointermove", onPinchMove, true);
  host.addEventListener("pointerup", onPinchUp, true);
  host.addEventListener("pointercancel", onPinchUp, true);
  host.addEventListener("pointerup", onUpDouble, true);
  host.addEventListener("pointercancel", onUpDouble, true);

  return {
    detach: () => {
      host.removeEventListener("pointerdown", onDownHandles, true);
      host.removeEventListener("pointerdown", onDownSnap, true);
      host.removeEventListener("pointermove", onMoveSnap, true);
      host.removeEventListener("pointerup", onMoveSnap, true);
      host.removeEventListener("pointerdown", onDownHandles, true);
      host.removeEventListener("pointerdown", onDownSnap, true);
      host.removeEventListener("pointermove", onMoveSnap, true);
      host.removeEventListener("pointerup", onMoveSnap, true);
      host.removeEventListener("pointerdown", onDown, true);
      host.removeEventListener("pointerup", onUp, true);
      host.removeEventListener("pointerdown", onDownBox, true);
      host.removeEventListener("pointermove", onMove, true);
      host.removeEventListener("pointerup", onUpBox, true);
      host.removeEventListener("pointercancel", onUpBox, true);
      host.removeEventListener("pointerdown", onPinchDown, true);
      host.removeEventListener("pointermove", onPinchMove, true);
      host.removeEventListener("pointerup", onPinchUp, true);
      host.removeEventListener("pointercancel", onPinchUp, true);
      host.removeEventListener("pointerup", onUpDouble, true);
      host.removeEventListener("pointercancel", onUpDouble, true);
      clearBox();
      pointerSnap = null;
      options.onMarqueeCancel?.(null);
    }
  };
}
