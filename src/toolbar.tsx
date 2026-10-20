import { createElement, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { ICONS, type IconName } from "./icons";
import type { ToolbarPosition } from "./settings";

type ToolName = "hand" | "selection" | "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "image" | "eraser";

interface ToolDefinition {
  tool: ToolName;
  icon: IconName;
  label: string;
}

/** Same order as Excalidraw's shapes panel, with the hand tool first. */
const TOOLS: readonly ToolDefinition[] = [
  { tool: "hand", icon: "hand", label: "Desplazar" },
  { tool: "selection", icon: "mouse-pointer-2", label: "Seleccionar" },
  { tool: "rectangle", icon: "square", label: "Rectángulo" },
  { tool: "diamond", icon: "diamond", label: "Rombo" },
  { tool: "ellipse", icon: "circle", label: "Elipse" },
  { tool: "arrow", icon: "arrow-up-right", label: "Flecha" },
  { tool: "line", icon: "minus", label: "Línea" },
  { tool: "freedraw", icon: "pencil", label: "Dibujo a mano" },
  { tool: "text", icon: "type", label: "Texto" },
  { tool: "image", icon: "image", label: "Imagen" },
  { tool: "eraser", icon: "eraser", label: "Borrador" }
];

interface CanvasToolbarProps {
  api: ExcalidrawImperativeAPI | null;
  activeTool: string;
  locked: boolean;
  position: ToolbarPosition;
  getCanvasElement: () => HTMLElement | null;
}

/** Lucide glyph rendered with Obsidian's own `.svg-icon` sizing rules. */
function Icon({ name }: { name: IconName }) {
  return createElement("svg", {
    className: "svg-icon jse-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    dangerouslySetInnerHTML: { __html: ICONS[name] }
  });
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * Excalidraw exposes `history.clear()` but no undo/redo in its public API, so
 * reuse its own keyboard shortcuts by replaying the key press on its container.
 */
function replayShortcut(getCanvasElement: () => HTMLElement | null, key: string, shiftKey = false): void {
  const canvas = getCanvasElement();
  if (!canvas || isEditableTarget(document.activeElement)) {
    return;
  }
  const code = key.toUpperCase().charCodeAt(0);
  canvas.dispatchEvent(new KeyboardEvent("keydown", {
    key,
    code: `Key${key.toUpperCase()}`,
    keyCode: code,
    which: code,
    ctrlKey: true,
    metaKey: true,
    shiftKey,
    bubbles: true,
    cancelable: true
  }));
}

export function CanvasToolbar({ api, activeTool, locked, position, getCanvasElement }: CanvasToolbarProps) {
  const selectTool = (tool: ToolName) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (api) {
      api.setActiveTool({ type: tool });
    }
  };

  const toggleLock = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    const current = TOOLS.find((definition) => definition.tool === activeTool)?.tool;
    if (api && current) {
      api.setActiveTool({ type: current, locked: !locked });
    }
  };

  const toolButton = ({ tool, icon, label }: ToolDefinition) => createElement("button", {
    key: tool,
    type: "button",
    className: `jse-tool clickable-icon${activeTool === tool ? " is-active" : ""}`,
    "aria-label": label,
    "aria-pressed": activeTool === tool,
    title: label,
    onClick: selectTool(tool)
  }, createElement(Icon, { name: icon }));

  const actionButton = (
    key: string,
    icon: IconName,
    label: string,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void,
    active = false
  ) => createElement("button", {
    key,
    type: "button",
    className: `jse-tool jse-tool--action clickable-icon${active ? " is-active" : ""}`,
    "aria-label": label,
    title: label,
    onClick
  }, createElement(Icon, { name: icon }));

  return createElement("div", {
    className: `jse-tools jse-tools--${position}`,
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => event.stopPropagation()
  },
  createElement("div", { className: "jse-tools__pill mod-raised" },
    TOOLS.map(toolButton),
    createElement("div", { className: "jse-tools__divider", role: "presentation" }),
    actionButton(
      "lock",
      locked ? "lock" : "lock-open",
      locked ? "Desbloquear herramienta" : "Bloquear herramienta",
      toggleLock,
      locked
    ),
    actionButton("undo", "undo-2", "Deshacer", (event) => {
      event.preventDefault();
      event.stopPropagation();
      replayShortcut(getCanvasElement, "z");
    }),
    actionButton("redo", "redo-2", "Rehacer", (event) => {
      event.preventDefault();
      event.stopPropagation();
      replayShortcut(getCanvasElement, "z", true);
    })
  ));
}
