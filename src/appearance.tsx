import {
  createElement,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import type { Capabilities } from "./capabilities";
import { Icon } from "./icons";
import { t } from "./i18n";
import { rowDelay } from "./motion";

/** Excalidraw stores rounded corners as `roundness: { type: 3 }` on shapes. */
const ROUND = 3;

/* The values panel is a grid of 36 px cells, 4 px apart. Everything the mark needs to place
   itself is derived from those two numbers and the height of the label above it. */
const CELL = 36;
const GAP = 4;
/** Every panel carries its property name on a row this tall, above the values. */
const LABEL_HEIGHT = 20;

/*
 * The properties of a selection.
 *
 * There is no palette to open: with something selected, the column itself becomes one button
 * per family (stroke, fill, thickness, line style, corners, size), each painted with the value
 * it holds, and tapping one opens its values beside the column.
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

/** How many cells each family holds. */
const FAMILY_COLUMNS: Record<Category, number> = {
  stroke: STROKE_COLORS.length,
  fill: 5,
  width: STROKE_WIDTHS.length,
  style: STROKE_STYLES.length,
  corners: EDGES.length,
  text: FONT_SIZES.length
};

export interface Family {
  key: Category;
  label: string;
  /** The button's face: the value it holds right now. */
  content: ReactNode;
}

/**
 * The families this selection can actually be styled with, in the order they appear in the
 * column. Built in reading order, then reversed: the column grows downwards, so the last
 * entries sit lowest — the two colours, nearest the thumb.
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
      content: createElement(Icon, { name: style.roundness === null ? "square" : "square-round-corner" })
    });
  }
  if (capabilities.text) {
    families.push({ key: "text", label: t("size"), content: createElement(Icon, { name: "type" }) });
  }
  return families.reverse();
}

export function panelLabel(category: Category): string {
  if (category === "stroke") return t("panelStroke");
  if (category === "fill") return t("panelFill");
  if (category === "width") return t("panelWeight");
  if (category === "style") return t("panelStyle");
  if (category === "corners") return t("panelRadius");
  return t("panelSize");
}

function chip(active: boolean, label: string, onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void, content: ReactNode, extra = "", delay = "0ms"): ReactNode {
  return createElement("button", {
    type: "button",
    className: `jse-appearance__chip${extra ? ` ${extra}` : ""}${active ? " is-active" : ""}`,
    "aria-label": label,
    "aria-pressed": active,
    title: label,
    /*
     * The cell is a bare box: only the colour inside it should be visible. Obsidian's button
     * base and community themes give every button a filled, ringed surface, and a theme rule
     * that targets the theme class can outrank any selector of ours. An inline surface beats
     * all of them without `!important`.
     */
    style: {
      animationDelay: delay,
      backgroundColor: "transparent",
      border: "0",
      boxShadow: "none"
    },
    onClick
  }, content);
}

function grid(children: ReactNode[], cols = 5): ReactNode {
  return createElement("div", {
    className: "jse-appearance__grid",
    style: { gridTemplateColumns: `repeat(${cols}, ${CELL}px)` }
  }, children);
}

interface AppearanceValuesProps {
  category: Category;
  style: StyleState;
  onPick: (patch: StylePatch) => void;
}

/**
 * The values of one family, in a panel anchored to the button that opened it. Nothing here is
 * measured from the DOM: the cells are a fixed grid (36 px + 4 px gap), so the mark of the
 * chosen value sits at a position known before it is painted.
 */
export function AppearanceValues({ category, style, onPick }: AppearanceValuesProps): ReactNode {
  const noFill = style.backgroundColor === "transparent";

  const activeIndex = (() => {
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
  })();

  /*
   * A mark close to the value it names, wearing that value's colour when it has one: a ring in
   * the accent colour says "the app", a ring in the colour says "this". Colours get a smaller
   * mark so it hugs the dot; the other families get a cell-sized one.
   */
  const isColour = category === "stroke" || category === "fill";
  const chosen = activeIndex < 0
    ? null
    : (category === "stroke"
        ? STROKE_COLORS[activeIndex]
        : category === "fill" ? FILL_COLORS[activeIndex] : null);
  const markSize = isColour ? 28 : CELL;
  const columns = Math.min(FAMILY_COLUMNS[category], 5);
  const pitch = CELL + GAP;
  const centre = (CELL - markSize) / 2;
  const top = LABEL_HEIGHT + centre;

  const cell = (() => {
    if (category !== "fill") {
      return {
        left: (activeIndex % columns) * pitch + centre,
        top: top + Math.floor(activeIndex / columns) * pitch
      };
    }
    if (activeIndex === 0) {
      // "No fill" sits alone, in the last column of its own row.
      return { left: 4 * pitch + centre, top };
    }
    const index = activeIndex - 1;
    return {
      left: (index % 5) * pitch + centre,
      top: top + pitch + Math.floor(index / 5) * pitch
    };
  })();

  const pick = (patch: StylePatch) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onPick(patch);
  };

  let values: ReactNode = null;
  if (category === "stroke") {
    values = grid(STROKE_COLORS.map((color, index) => chip(
      style.strokeColor.toLowerCase() === color,
      `${t("colourStroke")} ${color}`,
      pick({ strokeColor: color }),
      createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color",
      rowDelay(index, 5)
    )));
  } else if (category === "fill") {
    const emptyChip = chip(
      noFill,
      t("noFill"),
      pick({ backgroundColor: "transparent" }),
      createElement("span", { className: "jse-appearance__none" }),
      "jse-appearance__chip--color",
      rowDelay(0, 5)
    );
    values = createElement("div", { className: "jse-appearance__fill" },
      createElement("div", { className: "jse-appearance__grid jse-appearance__grid--single" },
        createElement("span", { style: { gridColumn: "5" } }, emptyChip)),
      grid(FILL_COLORS.slice(1).map((color, index) => chip(
        style.backgroundColor.toLowerCase() === color,
        `${t("colourFill")} ${color}`,
        pick({ backgroundColor: color as string, fillStyle: style.fillStyle === "hachure" ? "solid" : style.fillStyle }),
        createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
        "jse-appearance__chip--color",
        rowDelay(index, 5)
      ))));
  } else if (category === "width") {
    values = grid(STROKE_WIDTHS.map((preset, index) => chip(
      style.strokeWidth === preset.value,
      preset.label(),
      pick({ strokeWidth: preset.value }),
      createElement("span", { className: "jse-appearance__line", style: { height: `${Math.min(6, preset.value)}px` } }),
      "jse-appearance__chip--line",
      rowDelay(index, 5)
    )), STROKE_WIDTHS.length);
  } else if (category === "style") {
    values = grid(STROKE_STYLES.map((entry, index) => chip(
      style.strokeStyle === entry.value,
      entry.label(),
      pick({ strokeStyle: entry.value }),
      createElement("span", { className: `jse-appearance__line jse-appearance__line--${entry.value}` }),
      "jse-appearance__chip--line",
      rowDelay(index, 5)
    )), STROKE_STYLES.length);
  } else if (category === "corners") {
    values = grid(EDGES.map((edge, index) => chip(
      edge.value === null ? style.roundness === null : style.roundness !== null,
      edge.label(),
      pick({ roundness: edge.value }),
      createElement(Icon, { name: edge.value ? "square-round-corner" : "square" }),
      "jse-appearance__chip--line",
      rowDelay(index, 5)
    )), EDGES.length);
  } else {
    values = grid(FONT_SIZES.map((font, index) => chip(
      style.fontSize === font.value,
      font.label(),
      pick({ fontSize: font.value }),
      createElement("span", { className: "jse-appearance__size" }, "A"),
      "jse-appearance__chip--font",
      rowDelay(index, 5)
    )), FONT_SIZES.length);
  }

  return createElement("div", { className: "jse-appearance__body" },
    activeIndex < 0
      ? null
      : createElement("div", {
          className: `jse-appearance__marker${isColour ? "" : " is-plain"}${isColour && chosen === null ? " is-void" : ""}`,
          style: {
            left: `${cell.left}px`,
            top: `${cell.top}px`,
            width: `${markSize}px`,
            height: `${markSize}px`,
            borderRadius: "50%",
            ["--jse-marker-ring" as never]: chosen ?? undefined
          }
        }),
    createElement("div", { className: "jse-appearance__label" }, panelLabel(category)),
    values);
}
