import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * Double tap then drag selects, while the hand tool stays the base tool.
 *
 * The canvas is left on the hand tool so a single drag pans, but a double tap
 * followed by a drag draws a selection marquee. Excalidraw cannot switch tool
 * mid-gesture (its state is read when the pointer goes down), so the gesture is
 * handled here: the second pointerdown is intercepted, the marquee is drawn as
 * an overlay, and the elements inside it are selected through the public API.
 *
 * A double tap without dragging switches to the selection tool instead, which
 * is what a marquee also ends with, so the handles are usable straight away.
 * Once that automatic selection is dropped, the hand tool comes back: it stays
 * the base tool.
 */

interface SceneElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isDeleted?: boolean;
  groupIds?: readonly string[];
  points?: readonly (readonly [number, number])[];
}

type Bounds = { left: number; top: number; right: number; bottom: number };

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  overlay: HTMLDivElement | null;
  selecting: boolean;
}

const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP_PX = 24;
const DRAG_THRESHOLD_PX = 8;
const SETTLE_MS = 180;

function elementBounds(element: SceneElement): Bounds {
  if (element.points?.length) {
    const xs = element.points.map((point) => point[0]);
    const ys = element.points.map((point) => point[1]);
    return {
      left: element.x + Math.min(...xs),
      top: element.y + Math.min(...ys),
      right: element.x + Math.max(...xs),
      bottom: element.y + Math.max(...ys)
    };
  }
  return {
    left: Math.min(element.x, element.x + element.width),
    top: Math.min(element.y, element.y + element.height),
    right: Math.max(element.x, element.x + element.width),
    bottom: Math.max(element.y, element.y + element.height)
  };
}

export function mountDoubleTapSelection(
  api: ExcalidrawImperativeAPI,
  getCanvas: () => HTMLElement | null,
  getHost: () => HTMLElement | null
): () => void {
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  let gesture: Gesture | null = null;
  let autoSelection = false;
  let selectionAtPointerDown = 0;
  let gestureEndedAt = 0;
  let disposed = false;

  const toScene = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = getCanvas();
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const state = api.getAppState();
    return {
      x: (clientX - rect.left) / state.zoom.value - state.scrollX,
      y: (clientY - rect.top) / state.zoom.value - state.scrollY
    };
  };

  const drawOverlay = (fromX: number, fromY: number, toX: number, toY: number): void => {
    if (!gesture) {
      return;
    }
    if (!gesture.overlay) {
      const host = getHost();
      if (!host) {
        return;
      }
      const overlay = document.createElement("div");
      overlay.className = "jse-marquee";
      host.appendChild(overlay);
      gesture.overlay = overlay;
    }
    const overlay = gesture.overlay;
    overlay.style.left = `${Math.min(fromX, toX)}px`;
    overlay.style.top = `${Math.min(fromY, toY)}px`;
    overlay.style.width = `${Math.abs(toX - fromX)}px`;
    overlay.style.height = `${Math.abs(toY - fromY)}px`;
  };

  const dropOverlay = (target: Gesture | null): void => {
    target?.overlay?.remove();
    if (target) {
      target.overlay = null;
    }
  };

  const selectInside = (fromX: number, fromY: number, toX: number, toY: number): void => {
    const start = toScene(Math.min(fromX, toX), Math.min(fromY, toY));
    const end = toScene(Math.max(fromX, toX), Math.max(fromY, toY));
    if (!start || !end) {
      return;
    }
    const elements = api.getSceneElements() as unknown as SceneElement[];
    const inside = new Set<string>();
    for (const element of elements) {
      if (element.isDeleted) {
        continue;
      }
      const bounds = elementBounds(element);
      if (bounds.left >= start.x && bounds.right <= end.x && bounds.top >= start.y && bounds.bottom <= end.y) {
        inside.add(element.id);
      }
    }

    // Selecting one member of a group selects the whole group, like Excalidraw
    // does: moving half a group would silently break its layout.
    const groups = new Set<string>();
    for (const element of elements) {
      if (!inside.has(element.id)) {
        continue;
      }
      for (const groupId of element.groupIds ?? []) {
        groups.add(groupId);
      }
    }
    for (const element of elements) {
      if ((element.groupIds ?? []).some((groupId) => groups.has(groupId))) {
        inside.add(element.id);
      }
    }

    const ids: Record<string, true> = {};
    const selectedGroups: Record<string, true> = {};
    for (const id of inside) {
      ids[id] = true;
    }
    for (const groupId of groups) {
      selectedGroups[groupId] = true;
    }
    api.updateScene({ appState: { selectedElementIds: ids, selectedGroupIds: selectedGroups, editingGroupId: null } });
  };

  function onPointerMove(event: PointerEvent): void {
    if (!gesture || event.pointerId !== gesture.pointerId) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    if (!gesture.selecting) {
      if (Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < DRAG_THRESHOLD_PX) {
        return;
      }
      gesture.selecting = true;
    }
    drawOverlay(gesture.startX, gesture.startY, event.clientX, event.clientY);
  }

  function finish(pointerId: number, clientX: number, clientY: number, cancelled: boolean): void {
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerCancel, true);
    const current = gesture;
    gesture = null;
    if (!current || current.pointerId !== pointerId) {
      return;
    }
    dropOverlay(current);
    if (cancelled) {
      return;
    }
    if (current.selecting) {
      selectInside(current.startX, current.startY, clientX, clientY);
    }
    api.setActiveTool({ type: "selection" });
    autoSelection = true;
    gestureEndedAt = performance.now();
  }

  function onPointerUp(event: PointerEvent): void {
    finish(event.pointerId, event.clientX, event.clientY, false);
  }

  function onPointerCancel(event: PointerEvent): void {
    finish(event.pointerId, 0, 0, true);
  }

  const onPointerDown = (event: PointerEvent): void => {
    if (disposed || !event.isPrimary || event.button !== 0) {
      return;
    }
    selectionAtPointerDown = Object.keys(api.getAppState().selectedElementIds).length;

    // Never steal a tap meant for a button, a menu or the style sheet.
    if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, [role='menu'], .Island")) {
      return;
    }

    const now = performance.now();
    const isDoubleTap = now - lastTapTime < DOUBLE_TAP_MS &&
      Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < DOUBLE_TAP_SLOP_PX;

    if (!isDoubleTap) {
      lastTapTime = now;
      lastTapX = event.clientX;
      lastTapY = event.clientY;
      return;
    }

    const activeType = api.getAppState().activeTool.type;
    if (activeType !== "hand" && activeType !== "selection") {
      return;
    }

    lastTapTime = 0;
    event.stopPropagation();
    event.preventDefault();
    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      overlay: null,
      selecting: false
    };
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
  };

  // Once an automatic switch to the selection tool has nothing selected any
  // more, the hand tool takes over again: it stays the base tool. Deferred,
  // because Excalidraw applies selection changes asynchronously.
  const onCanvasPointerUp = (): void => {
    window.setTimeout(() => {
      if (disposed) {
        return;
      }
      if (!autoSelection) {
        return;
      }
      // The tap that ended our own gesture must not undo it.
      if (performance.now() - gestureEndedAt < 400) {
        return;
      }
      const state = api.getAppState();
      if (state.activeTool.type !== "selection") {
        autoSelection = false;
        return;
      }
      const selected = Object.keys(state.selectedElementIds).length;
      // A tap that leaves nothing selected hands back to the hand tool.
      if (selected === 0) {
        autoSelection = false;
        api.setActiveTool({ type: "hand" });
      }
    }, SETTLE_MS);
  };

  const host = getHost();
  host?.addEventListener("pointerdown", onPointerDown, true);
  host?.addEventListener("pointerup", onCanvasPointerUp);

  return () => {
    disposed = true;
    host?.removeEventListener("pointerdown", onPointerDown, true);
    host?.removeEventListener("pointerup", onCanvasPointerUp);
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerCancel, true);
    dropOverlay(gesture);
    gesture = null;
  };
}
