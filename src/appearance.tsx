import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import type { Capabilities } from "./capabilities";
import { Icon } from "./icons";
import { t } from "./i18n";

/** Excalidraw stores rounded corners as `roundness: { type: 3 }` on shapes. */
const ROUND = 3;

/*
 * The properties of a selection, as a row of families in the column itself: each button shows
 * the value it currently holds, and tapping it opens that family's values beside the column.
 * There is no palette to open first — the column *is* the palette while something is selected.
 */

export const STROKE_COLORS: readonly string[] = [
  "#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00",
  "#9c36b5", "#0c8599", "#e8590c", "#495057", "#5f3dc4"
];

export const FILL_COLORS: readonly (string | null)[] = [
  null,
  "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99", "#eebefa",
  "#d0bfff", "#c3fae8", "#ced4da", "#ffd8a8", "#868e96"
];

const STROKE_WIDTHS: readonly { value: number; label: () => string }[] = [
  { value: 1, label: () => t("thin") },
  { value: 2, label: () => t("medium") },
  { value: 4, label: () => t("thick") }
];

const STROKE_STYLES: readonly { value: string; label: () => string }[] = [
  { value: "solid", label: () => t("solid") },
  { value: "dashed", label: () => t("dashed") },
  { value: "dotted", label: () => t("dotted") }
];

const EDGES: readonly { value: number | null; label: () => string }[] = [
  { value: null, label: () => t("sharpCorners") },
  { value: ROUND, label: () => t("roundCorners") }
];

const FONT_SIZES: readonly { value: number; label: () => string }[] = [
  { value: 16, label: () => t("small") },
  { value: 20, label: () => t("normal") },
  { value: 28, label: () => t("large") },
  { value: 36, label: () => t("huge") }
];

export interface StyleState {
  strokeColor: string;
  backgroundColor: string;
  strokeWidth: number;
  strokeStyle: string;
  fillStyle: string;
  fontSize: number;
  roundness: number | null;
}

export interface StylePatch {
  strokeColor?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  strokeStyle?: string;
  fillStyle?: string;
  fontSize?: number;
  roundness?: number | null;
}

export type Category = "stroke" | "fill" | "width" | "style" | "corners" | "text";

export interface Family {
  key: Category;
  label: string;
  /** The button's face: the value it holds right now. */
  content: ReactNode;
}

function chip(active: boolean, label: string, onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void, content: ReactNode, extra = ""): ReactNode {
  return createElement("button", {
    type: "button",
    className: `jse-appearance__chip${extra ? ` ${extra}` : ""}${active ? " is-active" : ""}`,
    "aria-label": label,
    "aria-pressed": active,
    title: label,
    onClick
  }, content);
}

/* One grid for every family: no label, the icon that opened it says what it is. */
function grid(children: ReactNode[], cols: number): ReactNode {
  return createElement("div", {
    className: "jse-appearance__grid",
    // The panel is only as wide as its family: two corners do not hold five columns.
    style: { gridTemplateColumns: `repeat(${cols}, 36px)` }
  }, children);
}

/**
 * The families this selection can actually be styled with, in the order they appear in the
 * column. Built in reading order, then reversed: the column grows downwards, so the last
 * entries are the lowest and nearest the thumb — the two colours.
 */
export function familiesFor(style: StyleState, capabilities: Capabilities): Family[] {
  const noFill = style.backgroundColor === "transparent";
  const families: Family[] = [];
  if (capabilities.stroke) {
    families.push({
      key: "stroke",
      label: t("stroke"),
      content: createElement("span", {
        className: "jse-appearance__swatch jse-appearance__swatch--ring",
        style: { borderColor: style.strokeColor }
      })
    });
  }
  if (capabilities.fill) {
    families.push({
      key: "fill",
      label: t("fill"),
      content: createElement("span", {
        className: `jse-appearance__swatch${noFill ? " is-empty" : ""}`,
        style: noFill ? {} : { backgroundColor: style.backgroundColor }
      })
    });
  }
  if (capabilities.width) {
    families.push({
      key: "width",
      label: t("thickness"),
      content: createElement("span", {
        className: "jse-appearance__bar",
        style: { height: `${Math.min(6, Math.max(1, style.strokeWidth))}px` }
      })
    });
  }
  if (capabilities.style) {
    families.push({
      key: "style",
      label: t("lineStyle"),
      content: createElement(Icon, { name: "dashes", className: `jse-line-style jse-line-style--${style.strokeStyle}` })
    });
  }
  if (capabilities.corners) {
    families.push({
      key: "corners",
      label: t("corners"),
      content: createElement(Icon, { name: style.roundness === null ? "square" : "squircle" })
    });
  }
  if (capabilities.text) {
    families.push({ key: "text", label: t("size"), content: createElement(Icon, { name: "type" }) });
  }
  return families.reverse();
}

/* Index of the chosen value in its family, or -1 when the selection mixes values. */
function activeIndexFor(category: Category, style: StyleState): number {
  if (category === "stroke") {
    return STROKE_COLORS.indexOf(style.strokeColor.toLowerCase());
  }
  if (category === "fill") {
    return FILL_COLORS.findIndex((color) => (color === null
      ? style.backgroundColor === "transparent"
      : style.backgroundColor.toLowerCase() === color));
  }
  if (category === "width") {
    return STROKE_WIDTHS.findIndex((entry) => entry.value === style.strokeWidth);
  }
  if (category === "style") {
    return STROKE_STYLES.findIndex((entry) => entry.value === style.strokeStyle);
  }
  if (category === "corners") {
    return EDGES.findIndex((edge) => (edge.value === null ? style.roundness === null : style.roundness !== null));
  }
  return FONT_SIZES.findIndex((font) => font.value === style.fontSize);
}

interface AppearanceValuesProps {
  category: Category;
  style: StyleState;
  onPick: (patch: StylePatch) => void;
  onPreview: (patch: StylePatch) => void;
  /** Called once the panel is in the DOM: the column re-measures what sits under it. */
  onShown?: () => void;
}

/**
 * The values of one family, in a panel anchored to the button that opened it. Nothing here is
 * measured: the cells are a fixed 5-column grid (36 px + 4 px gap), so the mark of the chosen
 * value sits at a position that is known before it is painted.
 */
export function AppearanceValues({ category, style, onPick, onPreview, onShown }: AppearanceValuesProps): ReactNode {
  // The slider has its own value while it is being dragged: the element is only
  // rewritten on release, so its style would otherwise lag a whole round trip.
  const [dragging, setDragging] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const width = dragging ?? style.strokeWidth;
  const noFill = style.backgroundColor === "transparent";

  const activeIndex = activeIndexFor(category, style);
  // Columns follow the family, so each family is only as wide as its cells.
  const counts: Record<Category, number> = {
    stroke: STROKE_COLORS.length,
    fill: FILL_COLORS.length,
    width: STROKE_WIDTHS.length,
    style: STROKE_STYLES.length,
    corners: EDGES.length,
    text: FONT_SIZES.length
  };
  const cols = Math.min(counts[category], 5);
  /*
   * The mark is placed from the cell it belongs to, measured after the DOM is written — the
   * panel's width now follows its family, so no arithmetic could predict where a cell lands.
   */
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [mark, setMark] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const active = inner && typeof inner.getBoundingClientRect === "function"
      ? inner.querySelector<HTMLElement>(".jse-appearance__chip.is-active")
      : null;
    if (!inner || !active) {
      setMark(null);
      return;
    }
    const frame = inner.getBoundingClientRect();
    const cell = active.getBoundingClientRect();
    setMark({ left: Math.round(cell.left - frame.left), top: Math.round(cell.top - frame.top) });
  }, [category, style.strokeColor, style.backgroundColor, style.strokeWidth, style.strokeStyle, style.roundness, style.fontSize, cols]);

  const marker = activeIndex < 0 || !mark
    ? null
    : { ...mark, round: category === "stroke" || category === "fill" };

  // The panel is a menu the column had no way to measure before it existed: tell it now, so
  // the backing appears if a shape sits under the values.
  useEffect(() => {
    onShown?.();
  }, [category, onShown]);

  /*
   * The panel is centred on its button, and the lowest button sits near the bottom of the
   * screen: a tall family would hang off the edge. Nudge it back inside, without changing
   * which button it belongs to.
   */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    panel.style.setProperty("--jse-panel-shift", "0px");
    const rect = panel.getBoundingClientRect();
    const margin = 8;
    const overTop = margin - rect.top;
    const overBottom = rect.bottom - (window.innerHeight - margin);
    const shift = overTop > 0 ? overTop : overBottom > 0 ? -overBottom : 0;
    if (shift !== 0) {
      panel.style.setProperty("--jse-panel-shift", `${Math.round(shift)}px`);
    }
  }, [category, dragging]);

  const pick = (patch: StylePatch) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onPick(patch);
  };

  let content: ReactNode = null;
  if (category === "stroke") {
    content = grid(STROKE_COLORS.map((color) => chip(
      style.strokeColor.toLowerCase() === color,
      `${t("colourStroke")} ${color}`,
      pick({ strokeColor: color }),
      createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color"
    )), cols);
  } else if (category === "fill") {
    content = grid(FILL_COLORS.map((color) => chip(
      (color === null && noFill) || (color !== null && style.backgroundColor.toLowerCase() === color),
      color === null ? t("noFill") : `${t("colourFill")} ${color}`,
      pick(color === null
        ? { backgroundColor: "transparent" }
        : { backgroundColor: color, fillStyle: style.fillStyle === "hachure" ? "solid" : style.fillStyle }),
      color === null
        ? createElement("span", { className: "jse-appearance__none" })
        : createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color"
    )), cols);
  } else if (category === "width") {
    content = createElement("div", { className: "jse-appearance__stack" },
      createElement("div", {
        className: "jse-appearance__choices",
        style: { gridTemplateColumns: `repeat(${cols}, 36px)` }
      }, STROKE_WIDTHS.map((preset) => chip(
        style.strokeWidth === preset.value,
        preset.label(),
        pick({ strokeWidth: preset.value }),
        createElement("span", { className: "jse-appearance__line", style: { height: `${Math.min(6, preset.value)}px` } }),
        "jse-appearance__chip--line"
      ))),
      createElement("div", { className: "jse-appearance__slider-row" },
        createElement("input", {
          type: "range",
          min: 0.5,
          max: 10,
          step: 0.5,
          value: String(width),
          className: "jse-appearance__slider",
          "aria-label": t("thickness"),
          // moving only shifts the default; releasing writes the elements, so the
          // history keeps one step instead of one per pixel
          onInput: (event: { target: EventTarget | null }) => {
            const next = Number((event.target as HTMLInputElement).value);
            setDragging(next);
            onPreview({ strokeWidth: next });
          },
          onPointerUp: () => {
            if (dragging !== null) {
              onPick({ strokeWidth: dragging });
              setDragging(null);
            }
          },
          onKeyUp: () => {
            if (dragging !== null) {
              onPick({ strokeWidth: dragging });
              setDragging(null);
            }
          }
        }),
        createElement("span", { className: "jse-appearance__value" }, width.toFixed(1))
      )
    );
  } else if (category === "style") {
    content = grid(STROKE_STYLES.map((entry) => chip(
      style.strokeStyle === entry.value,
      entry.label(),
      pick({ strokeStyle: entry.value }),
      createElement("span", { className: `jse-appearance__line jse-appearance__line--${entry.value}` }),
      "jse-appearance__chip--line"
    )), cols);
  } else if (category === "corners") {
    content = grid(EDGES.map((edge) => chip(
      edge.value === null ? style.roundness === null : style.roundness !== null,
      edge.label(),
      pick({ roundness: edge.value }),
      createElement("span", { className: `jse-appearance__shape${edge.value ? " is-round" : ""}` }),
      "jse-appearance__chip--line"
    )), cols);
  } else {
    content = grid(FONT_SIZES.map((font) => chip(
      style.fontSize === font.value,
      font.label(),
      pick({ fontSize: font.value }),
      createElement("span", { className: "jse-appearance__size" }, "A"),
      "jse-appearance__chip--font"
    )), cols);
  }

  return createElement("div", { className: "jse-appearance__values-inner", ref: (node: HTMLDivElement | null) => {
    panelRef.current = node;
    innerRef.current = node;
    return undefined as never;
  } },
    marker
      ? createElement("div", {
          className: "jse-appearance__marker",
          style: {
            left: `${marker.left}px`,
            top: `${marker.top}px`,
            width: "36px",
            height: "36px",
            borderRadius: marker.round ? "50%" : "var(--radius-s, 8px)"
          }
        })
      : null,
    content);
}
