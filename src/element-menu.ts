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
