/**
 * The element menu.
 *
 * On a phone, Excalidraw's own element menu is a desktop artefact: a small floating panel with rows
 * of text, placed wherever the finger happened to be, often half under it. Obsidian has a native
 * component for exactly this moment - `Menu` - and on mobile it opens as the sheet that rises from
 * the bottom of the screen, the same one a long press on a file gives.
 *
 * So the long press opens that instead, with the actions a board actually offers. Everything here
 * goes through the public API, and every write is marked as an edit, because every item here changes
 * the drawing.
 */

import { Menu } from "obsidian";
import { exportToClipboard, restoreElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { pressExcalidrawButton, replayShortcut } from "./toolbar";

export interface ElementMenuContext {
  api: ExcalidrawImperativeAPI;
  /** The element the long press landed on, already part of the selection. */
  id: string;
  getCanvasElement: () => HTMLElement | null;
  haptic?: (style: "light" | "heavy") => void;
}

const CAPTURE = "IMMEDIATELY" as never;

function selected(api: ExcalidrawImperativeAPI): string[] {
  const ids = Object.keys(api.getAppState().selectedElementIds ?? {});
  return ids.length > 0 ? ids : [];
}

function write(api: ExcalidrawImperativeAPI, elements: readonly unknown[]): void {
  api.updateScene({ elements: elements as never, captureUpdate: CAPTURE });
}

/** The same format Excalidraw puts on the clipboard, so a paste here or in another board works. */
function clipboardPayload(api: ExcalidrawImperativeAPI, ids: string[]): string {
  const elements = api.getSceneElements().filter((element) => ids.includes(element.id));
  const available = (api.getFiles?.() ?? {}) as Record<string, unknown>;
  const files: Record<string, unknown> = {};
  for (const element of elements) {
    const fileId = (element as { fileId?: string }).fileId;
    if (fileId && available[fileId]) {
      files[fileId] = available[fileId];
    }
  }
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "boards",
    elements,
    appState: { gridSize: null, viewBackgroundColor: "#ffffff" },
    files
  });
}

/*
 * Excalidraw keeps its copied styles inside its own app state; a menu built outside it keeps its own,
 * which is enough for "copy here, paste there" inside one board.
 */
let styleClipboard: Record<string, unknown> | null = null;

const STYLE_KEYS = [
  "strokeColor", "backgroundColor", "fillStyle", "strokeWidth", "strokeStyle", "roughness",
  "opacity", "roundness", "fontFamily", "fontSize", "textAlign", "verticalAlign", "edges"
] as const;

function copyStyles(elements: readonly Record<string, unknown>[]): void {
  const source = elements[0];
  if (!source) {
    return;
  }
  const kept: Record<string, unknown> = {};
  for (const key of STYLE_KEYS) {
    if (kept && source[key] !== undefined) {
      kept[key] = source[key];
    }
  }
  styleClipboard = kept;
}

function withStyles(element: Record<string, unknown>, styles: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...element, ...styles };
  next.version = (element.version as number) + 1;
  next.versionNonce = Math.floor(Math.random() * 1e9);
  return next;
}

/** One step in the z-order: the neighbours swap, and only with elements that are not also moving. */
function shiftOrder(
  elements: readonly Record<string, unknown>[],
  ids: string[],
  direction: 1 | -1
): readonly Record<string, unknown>[] {
  const next = [...elements];
  const order = direction > 0 ? [...next.keys()].reverse() : [...next.keys()];
  for (const index of order) {
    const element = next[index];
    if (!element || !ids.includes(element.id as string)) {
      continue;
    }
    const target = index + direction;
    if (target < 0 || target >= next.length) {
      continue;
    }
    if (ids.includes(next[target].id as string)) {
      continue;
    }
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function frameAround(
  elements: readonly Record<string, unknown>[],
  ids: string[]
): readonly Record<string, unknown>[] {
  const chosen = elements.filter((element) => ids.includes(element.id as string));
  if (chosen.length === 0) {
    return elements;
  }
  const left = Math.min(...chosen.map((element) => element.x as number));
  const top = Math.min(...chosen.map((element) => element.y as number));
  const right = Math.max(...chosen.map((element) => (element.x as number) + Math.abs(element.width as number)));
  const bottom = Math.max(...chosen.map((element) => (element.y as number) + Math.abs(element.height as number)));
  const padding = 20;
  const frameId = crypto.randomUUID();
  const frame = {
    id: frameId,
    type: "frame",
    x: left - padding,
    y: top - padding,
    width: right - left + padding * 2,
    height: bottom - top + padding * 2,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: Math.floor(Math.random() * 1e9),
    version: 1,
    versionNonce: Math.floor(Math.random() * 1e9),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    name: "Frame"
  };
  return [
    frame as unknown as Record<string, unknown>,
    ...elements.map((element) => (
      ids.includes(element.id as string)
        ? { ...element, frameId, version: (element.version as number) + 1, versionNonce: Math.floor(Math.random() * 1e9) }
        : element
    ))
  ];
}

export function openElementMenu(context: ElementMenuContext): void {
  const { api, id, getCanvasElement, haptic } = context;
  const menu = new Menu();
  const ids = selected(api);
  const all = api.getSceneElements();
  const chosen = all.filter((element) => ids.includes(element.id));
  const target = all.find((element) => element.id === id);
  const grouped = chosen.some((element) => element.groupIds.length > 0);
  const onlyText = chosen.length === 1 && chosen[0].type === "text";
  const locked = chosen.length > 0 && chosen.every((element) => element.locked);
  interface Item {
    title: string;
    icon?: string;
    section?: string;
    callback?: () => void;
  }
  const items: Item[] = [];

  items.push({
    title: "Copy",
    icon: "copy",
    section: "clipboard",
    callback: () => {
      void navigator.clipboard?.writeText(clipboardPayload(api, ids)).catch(() => undefined);
    }
  });
  items.push({
    title: "Cut",
    icon: "scissors",
    section: "clipboard",
    callback: () => {
      void navigator.clipboard?.writeText(clipboardPayload(api, ids)).catch(() => undefined);
      if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Delete"]')) {
        replayShortcut(getCanvasElement, "Delete", false, false, 46, "Delete");
      }
    }
  });
  items.push({
    title: "Paste",
    icon: "clipboard-paste",
    section: "clipboard",
    callback: () => {
      void (async () => {
        try {
          const text = await navigator.clipboard?.readText();
          if (!text) {
            return;
          }
          const payload = JSON.parse(text) as { elements?: unknown[]; files?: Record<string, unknown> };
          if (!Array.isArray(payload.elements) || payload.elements.length === 0) {
            return;
          }
          /*
           * Every id is remapped, otherwise the paste would collide with the elements it came from;
           * frames and groups travel with their members, and images bring their files along.
           */
          const idMap = new Map<string, string>();
          const remap = (value: string): string => {
            const known = idMap.get(value);
            if (known) {
              return known;
            }
            const fresh = crypto.randomUUID();
            idMap.set(value, fresh);
            return fresh;
          };
          const pasted = (payload.elements as Record<string, unknown>[]).map((element) => ({
            ...element,
            id: remap(String(element.id ?? crypto.randomUUID())),
            x: (element.x as number) + 24,
            y: (element.y as number) + 24,
            groupIds: ((element.groupIds as string[]) ?? []).map(remap),
            frameId: element.frameId ? remap(String(element.frameId)) : null,
            version: 1,
            versionNonce: Math.floor(Math.random() * 1e9),
            isDeleted: false
          }));
          const files = payload.files ?? {};
          if (Object.keys(files).length > 0) {
            api.addFiles(Object.values(files) as never);
          }
          const elements = [...api.getSceneElements(), ...pasted];
          api.updateScene({
            elements: restoreElements(elements as never, null) as never,
            appState: { selectedElementIds: Object.fromEntries(pasted.map((element) => [element.id, true])) } as never,
            captureUpdate: CAPTURE
          });
        } catch {
          // A clipboard holding something else is not an error: there is simply nothing to paste.
        }
      })();
    }
  });
  items.push({
    title: "Duplicate",
    icon: "copy-plus",
    callback: () => {
      if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Duplicate"]')) {
        replayShortcut(getCanvasElement, "d", false, true, 68, "KeyD");
      }
    }
  });

  if (onlyText) {
    items.push({
      title: "Edit text",
      icon: "square-pen",
      callback: () => replayShortcut(getCanvasElement, "Enter", false, false, 13, "Enter")
    });
  }

  items.push({
    title: "Copy styles",
    icon: "paintbrush",
    section: "styles",
    callback: () => copyStyles(chosen as unknown as Record<string, unknown>[])
  });
  items.push({
    title: "Paste styles",
    icon: "paintbrush-vertical",
    section: "styles",
    callback: () => {
      if (!styleClipboard) {
        return;
      }
      write(api, all.map((element) => (
        ids.includes(element.id)
          ? withStyles(element as unknown as Record<string, unknown>, styleClipboard as Record<string, unknown>)
          : element
      )));
    }
  });
  items.push({
    title: "Copy to clipboard as PNG",
    icon: "image",
    section: "export",
    callback: () => {
      void exportToClipboard({
        elements: chosen as never,
        appState: api.getAppState() as never,
        files: api.getFiles() as never,
        type: "png"
      } as never).catch(() => undefined);
    }
  });
  items.push({
    title: "Copy to clipboard as SVG",
    icon: "image-down",
    section: "export",
    callback: () => {
      void exportToClipboard({
        elements: chosen as never,
        appState: api.getAppState() as never,
        files: api.getFiles() as never,
        type: "svg"
      } as never).catch(() => undefined);
    }
  });
  items.push({
    title: "Wrap selection in frame",
    icon: "frame",
    section: "structure",
    callback: () => write(api, frameAround(all as unknown as Record<string, unknown>[], ids))
  });
  items.push({
    title: "Bring forward",
    icon: "arrow-up",
    section: "order",
    callback: () => write(api, shiftOrder(all as unknown as Record<string, unknown>[], ids, 1))
  });
  items.push({
    title: "Send backward",
    icon: "arrow-down",
    section: "order",
    callback: () => write(api, shiftOrder(all as unknown as Record<string, unknown>[], ids, -1))
  });
  items.push({
    title: "Bring to front",
    icon: "arrow-up-to-line",
    section: "order",
    callback: () => {
      const rest = all.filter((element) => !ids.includes(element.id));
      write(api, [...rest, ...chosen]);
    }
  });
  items.push({
    title: "Send to back",
    icon: "arrow-down-to-line",
    section: "order",
    callback: () => {
      const rest = all.filter((element) => !ids.includes(element.id));
      write(api, [...chosen, ...rest]);
    }
  });

  if (chosen.length > 1 && !grouped) {
    items.push({
      title: "Group",
      icon: "group",
      section: "structure",
      callback: () => {
        const groupId = crypto.randomUUID();
        write(api, all.map((element) => (
          ids.includes(element.id)
            ? { ...element, groupIds: [...element.groupIds, groupId], version: element.version + 1, versionNonce: Math.floor(Math.random() * 1e9) }
            : element
        )));
      }
    });
  }
  if (grouped) {
    items.push({
      title: "Ungroup",
      icon: "ungroup",
      section: "structure",
      callback: () => {
        const last = chosen.reduce<string | null>((value, element) => (
          element.groupIds.length > 0 ? element.groupIds[element.groupIds.length - 1] : value
        ), null);
        write(api, all.map((element) => (
          last && element.groupIds.includes(last)
            ? { ...element, groupIds: element.groupIds.filter((groupId) => groupId !== last), version: element.version + 1, versionNonce: Math.floor(Math.random() * 1e9) }
            : element
        )));
      }
    });
  }

  if (target) {
    items.push({
      title: locked ? "Unlock" : "Lock",
      icon: locked ? "lock-open" : "lock",
      section: "protection",
      callback: () => {
        write(api, all.map((element) => (
          ids.includes(element.id)
            ? { ...element, locked: !locked, version: element.version + 1, versionNonce: Math.floor(Math.random() * 1e9) }
            : element
        )));
      }
    });
  }

  items.push({
    title: "Delete",
    icon: "trash-2",
    section: "danger",
    callback: () => {
      haptic?.("heavy");
      if (!pressExcalidrawButton('.App-bottom-bar button[aria-label="Delete"]')) {
        replayShortcut(getCanvasElement, "Delete", false, false, 46, "Delete");
      }
    }
  });

  for (const item of items) {
    menu.addItem((entry) => {
      entry.setTitle(item.title);
      if (item.icon) {
        entry.setIcon(item.icon);
      }
      if (item.section) {
        entry.setSection(item.section);
      }
      if (item.callback) {
        entry.onClick(item.callback);
      }
    });
  }

  menu.showAtPosition({ x: 0, y: window.innerHeight });
}
