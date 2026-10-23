import {
  createElement,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";
import type { Capabilities } from "./capabilities";
import { Icon } from "./icons";
import { t } from "./i18n";
import { menuDelay, rowDelay } from "./motion";

/** Excalidraw stores rounded corners as `roundness: { type: 3 }` on shapes. */
const ROUND = 3;

/* The values panel is a fixed box: five cells of 36 px and four gaps of 4 px. Everything the mark
   needs to place itself is derived from those three numbers. */
const CELL = 36;
const GAP = 4;
const PANEL_WIDTH = 5 * CELL + 4 * GAP;
/** Every panel carries its property name on a row this tall, above the values. */
const LABEL_HEIGHT = 20;

/*
 * Appearance, in two levels: one icon per family along a row that slides out of the
 * button, then the values of that family in a list that opens above it. The single
 * long panel it replaces took the whole column height and pushed the drawing away.
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

type Category = "stroke" | "fill" | "width" | "style" | "corners" | "text";

/** How many cells each family holds: it decides how the panel centres its grid. */
const FAMILY_COLUMNS: Record<Category, number> = {
  stroke: 5,
  fill: 5,
  width: STROKE_WIDTHS.length,
  style: STROKE_STYLES.length,
  corners: EDGES.length,
  text: FONT_SIZES.length
};

interface AppearanceMenuProps {
  open: boolean;
  style: StyleState;
  capabilities: Capabilities;
  onPick: (patch: StylePatch) => void;
  onPreview: (patch: StylePatch) => void;
  /** Tells the owner when a family is open, so the popover can change shape. */
  onExpand?: (expanded: boolean) => void;
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

/* One grid for every family: no label per cell, the panel has one for the whole property. */
function grid(children: ReactNode[], cols = 5): ReactNode {
  return createElement("div", {
    className: "jse-appearance__grid",
    style: { gridTemplateColumns: `repeat(${cols}, 36px)` }
  }, children);
}

export function AppearanceMenu({ open, style, capabilities, onPick, onPreview, onExpand }: AppearanceMenuProps) {
  // The slider has its own value while it is being dragged: the element is only
  // rewritten on release, so its style would otherwise lag a whole round trip.
  const [dragging, setDragging] = useState<number | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  // Kept mounted while it collapses, so the panel can animate its height both ways.
  const [shownCategory, setShownCategory] = useState<Category | null>(null);
  const width = dragging ?? style.strokeWidth;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const heightSignatureRef = useRef("");
  const [panelHeight, setPanelHeight] = useState(0);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const familySignatureRef = useRef("");
  const [familyMarker, setFamilyMarker] = useState<{ left: number; top: number; size: number } | null>(null);

  /*
   * The mark is computed from the index of the chosen value, not measured from the DOM: the
   * cells are a fixed 5-column grid (36 px + 4 px gap, 2 px of panel padding), so the position
   * is known before the family is even painted. Measuring raced the render and left the mark
   * on the previous family's cell.
   */
  const activeIndex = (() => {
    if (!category) {
      return -1;
    }
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
  // The thickness family wraps its presets in a stack with its own 6 px gap; the grid inside it
  // starts flush, so no extra inset is needed since the panel lost its inline padding.
  /*
   * The mark sits close to a colour and wears that colour: a coloured value is best announced by
   * itself, not by the app's accent. It is smaller than a cell, so the ring hugs the dot instead
   * of floating around it, and it is centred on the cell it belongs to.
   */
  const isColour = category === "stroke" || category === "fill";
  const chosen = isColour && activeIndex >= 0
    ? (category === "stroke" ? STROKE_COLORS[activeIndex] : FILL_COLORS[activeIndex])
    : null;
  const markSize = isColour ? 28 : 36;
  /*
   * The fills are three rows the arithmetic has to know about: "no fill" alone and centred on
   * the first one, then the ten colours in two rows of five, 4 px under it. Every other family
   * is a plain five-column grid.
   */
  const markerCell = (): { left: number; top: number } => {
    const centre = (CELL - markSize) / 2;
    const pitch = CELL + GAP;
    // A grid narrower than the panel is centred in it: the mark must start where its cells do.
    const columns = category ? Math.min(FAMILY_COLUMNS[category], 5) : 5;
    const offset = (PANEL_WIDTH - (columns * pitch - GAP)) / 2;
    const top = LABEL_HEIGHT + centre;

    if (category !== "fill") {
      return {
        left: offset + (activeIndex % columns) * pitch + centre,
        top: top + Math.floor(activeIndex / columns) * pitch
      };
    }
    if (activeIndex === 0) {
      // "No fill" sits alone, in the last column of its own row.
      return { left: offset + 4 * pitch + centre, top };
    }
    const cell = activeIndex - 1;
    // The colours start one row and one gap below the "no fill" row.
    return {
      left: offset + (cell % 5) * pitch + centre,
      top: top + pitch + Math.floor(cell / 5) * pitch
    };
  };
  const marker = activeIndex < 0
    ? null
    : {
        ...markerCell(),
        size: markSize,
        plain: !isColour,
        round: true,
        // `null` means "no fill": there is no colour to wear, the accent stays — and the ring is
        // dashed, like the crossed circle it surrounds: a solid ring would promise a colour.
        void: isColour && chosen === null,
        ring: chosen ?? undefined
      };


  // Closing the menu ends any half-finished drag and forgets the open family.
  useEffect(() => {
    if (!open) {
      setCategory(null);
    }
  }, [open]);

  useEffect(() => {
    if (category) {
      setShownCategory(category);
    }
  }, [category]);

  // The popover is a capsule while it is only its row of families; once a family opens it
  // takes the ordinary panel corners, so growing does not blow the radius up.
  useEffect(() => {
    onExpand?.(open && category !== null);
  }, [onExpand, open, category]);

  // How tall the open family is right now.
  useEffect(() => {
    const inner = innerRef.current;
    const next = inner && category ? Math.ceil(inner.getBoundingClientRect().height) : 0;
    const signature = String(next);
    if (signature !== heightSignatureRef.current) {
      heightSignatureRef.current = signature;
      setPanelHeight(next);
    }
  }, [category, shownCategory, capabilities, style, open]);

  // Where the open family sits in its row, measured from the row itself.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) {
      return;
    }
    const active = row.querySelector<HTMLElement>(".jse-appearance__category.is-active");
    if (!active) {
      if (familySignatureRef.current !== "none") {
        familySignatureRef.current = "none";
        setFamilyMarker(null);
      }
      return;
    }
    const next = { left: active.offsetLeft, top: active.offsetTop, size: active.offsetWidth };
    const signature = `${next.left},${next.top},${next.size}`;
    if (signature !== familySignatureRef.current) {
      familySignatureRef.current = signature;
      setFamilyMarker(next);
    }
  }, [category, capabilities, open]);

  // A family that no longer applies (the selection changed) closes itself.
  useEffect(() => {
    const available: Category[] = [
      ...(capabilities.stroke ? ["stroke" as Category] : []),
      ...(capabilities.fill ? ["fill" as Category] : []),
      ...(capabilities.width ? ["width" as Category] : []),
      ...(capabilities.style ? ["style" as Category] : []),
      ...(capabilities.corners ? ["corners" as Category] : []),
      ...(capabilities.text ? ["text" as Category] : [])
    ];
    if (category && !available.includes(category)) {
      setCategory(null);
    }
  }, [capabilities, category]);

  const pick = (patch: StylePatch) => (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    onPick(patch);
  };

  const categoryButton = (key: Category, label: string, content: ReactNode, delay = "0ms"): ReactNode => createElement("button", {
    type: "button",
    className: `jse-tool clickable-icon jse-appearance__category${open ? " is-entering" : ""}${category === key ? " is-active" : ""}`,
    style: { animationDelay: delay },
    "aria-label": label,
    "aria-pressed": category === key,
    title: label,
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setCategory((current) => (current === key ? null : key));
    }
  }, content);

  const noFill = style.backgroundColor === "transparent";
  // Rightmost appears first, like the shape strip: the delay shrinks along the row.
  const delayFor = (index: number): string => menuDelay(index, families.length);
  const families: { key: Category; label: string; content: ReactNode }[] = [
    ...(capabilities.stroke ? [{
      key: "stroke" as Category,
      label: t("stroke"),
      content: createElement("span", {
        className: "jse-appearance__swatch jse-appearance__swatch--ring",
        style: { borderColor: style.strokeColor }
      })
    }] : []),
    ...(capabilities.fill ? [{
      key: "fill" as Category,
      label: t("fill"),
      content: createElement("span", {
        className: `jse-appearance__swatch${noFill ? " is-empty" : ""}`,
        style: noFill ? {} : { backgroundColor: style.backgroundColor }
      })
    }] : []),
    ...(capabilities.width ? [{
      key: "width" as Category,
      label: t("thickness"),
      content: createElement("span", {
        className: "jse-appearance__bar",
        style: { height: `${Math.min(6, Math.max(1, style.strokeWidth))}px` }
      })
    }] : []),
    ...(capabilities.style ? [{
      key: "style" as Category,
      label: t("lineStyle"),
      content: createElement(Icon, { name: "dashes", className: `jse-line-style jse-line-style--${style.strokeStyle}` })
    }] : [])
  ];
  if (capabilities.corners) {
    families.push({
      key: "corners",
      label: t("corners"),
      // Lucide's square-round-corner says "the corners of this box", where a circle suggested a
      // shape rather than a property.
      content: createElement(Icon, { name: style.roundness === null ? "square" : "square-round-corner" })
    });
  }
  if (capabilities.text) {
    families.push({ key: "text", label: t("size"), content: createElement(Icon, { name: "type" }) });
  }

  /*
   * Colours sit nearest the thumb. The popover opens at the right edge of the screen, so the
   * last cells of the row are the easy ones to reach: the families are built in reading
   * order, then reversed so stroke and fill end up there.
   */
  families.reverse();

  const panelLabel = (which: Category | null): string => {
    if (which === "stroke") return t("panelStroke");
    if (which === "fill") return t("panelFill");
    if (which === "width") return t("panelWeight");
    if (which === "style") return t("panelStyle");
    if (which === "corners") return t("panelRadius");
    return t("panelSize");
  };

  const panelFor = (which: Category | null): ReactNode => {
    let panel: ReactNode = null;
    if (which === "stroke") {
    panel = createElement("div", { className: "jse-appearance__grid" }, STROKE_COLORS.map((color, index) => chip(
      style.strokeColor.toLowerCase() === color,
      `${t("colourStroke")} ${color}`,
      pick({ strokeColor: color }),
      createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
      "jse-appearance__chip--color",
      rowDelay(index, 5)
    )));
  } else if (which === "fill") {
    const emptyChip = chip(
      noFill,
      t("noFill"),
      pick({ backgroundColor: "transparent" }),
      createElement("span", { className: "jse-appearance__none" }),
      "jse-appearance__chip--color",
      rowDelay(0, 5)
    );
    panel = createElement("div", { className: "jse-appearance__fill" },
      createElement("div", { className: "jse-appearance__grid jse-appearance__grid--single" },
        createElement("span", { style: { gridColumn: "5" } }, emptyChip)),
      createElement("div", { className: "jse-appearance__grid" }, FILL_COLORS.slice(1).map((color, index) => chip(
        style.backgroundColor.toLowerCase() === color,
        `${t("colourFill")} ${color}`,
        pick({ backgroundColor: color as string, fillStyle: style.fillStyle === "hachure" ? "solid" : style.fillStyle }),
        createElement("span", { className: "jse-appearance__dot", style: { backgroundColor: color } }),
        "jse-appearance__chip--color",
        rowDelay(index, 5)
      ))));
  } else if (which === "width") {
    panel = grid(STROKE_WIDTHS.map((preset, index) => chip(
      style.strokeWidth === preset.value,
      preset.label(),
      pick({ strokeWidth: preset.value }),
      createElement("span", { className: "jse-appearance__line", style: { height: `${Math.min(6, preset.value)}px` } }),
      "jse-appearance__chip--line",
      rowDelay(index, 5)
    )), STROKE_WIDTHS.length);
  } else if (which === "style") {
    panel = grid(STROKE_STYLES.map((entry, index) => chip(
      style.strokeStyle === entry.value,
      entry.label(),
      pick({ strokeStyle: entry.value }),
      createElement("span", { className: `jse-appearance__line jse-appearance__line--${entry.value}` }),
      "jse-appearance__chip--line",
      rowDelay(index, 5)
    )), STROKE_STYLES.length);
  } else if (which === "corners") {
    panel = grid(EDGES.map((edge, index) => chip(
      edge.value === null ? style.roundness === null : style.roundness !== null,
      edge.label(),
      pick({ roundness: edge.value }),
      // Both states are the same Lucide glyph the level 1 button uses, so they read as one
      // control: a square, and the same square with a rounded corner.
      createElement(Icon, { name: edge.value ? "square-round-corner" : "square" }),
      "jse-appearance__chip--line",
      rowDelay(index, 5)
    )), EDGES.length);
  } else if (which === "text") {
    panel = grid(FONT_SIZES.map((font, index) => chip(
      style.fontSize === font.value,
      font.label(),
      pick({ fontSize: font.value }),
      createElement("span", { className: "jse-appearance__size" }, "A"),
      "jse-appearance__chip--font",
      rowDelay(index, 5)
    )), FONT_SIZES.length);
  }

  return createElement("div", { className: "jse-appearance__body" },
    createElement("div", { className: "jse-appearance__label" }, panelLabel(which)),
    panel);
  };

  return createElement("div", { className: "jse-appearance" },
    /*
     * The panel animates its own height, and stays mounted while it collapses, so the
     * popover grows and shrinks smoothly instead of jumping.
     */
    createElement("div", {
      ref: panelRef,
      className: `jse-appearance__panel${category ? " is-open" : ""}`,
      style: { height: category ? `${panelHeight}px` : "0px" }
    },
      createElement("div", { ref: innerRef, className: "jse-appearance__inner" },
      marker
        ? createElement("div", {
            // One marker per family: switching family starts a fresh one where the value is,
            // instead of dragging the previous family's circle across and morphing it.
            key: `marker-${shownCategory}`,
            className: `jse-appearance__marker${marker.void ? " is-void" : ""}${marker.plain ? " is-plain" : ""}`,
            style: {
              left: `${marker.left}px`,
              top: `${marker.top}px`,
              width: `${marker.size}px`,
              height: `${marker.size}px`,
              borderRadius: "50%",
              ["--jse-marker-ring" as never]: marker.ring
            }
          })
        : null,
      panelFor(shownCategory))),
    createElement("div", { className: "jse-appearance__categories", ref: rowRef },
      familyMarker
        ? createElement("div", {
            className: "jse-appearance__family-marker",
            style: {
              left: `${familyMarker.left}px`,
              top: `${familyMarker.top}px`,
              width: `${familyMarker.size}px`,
              height: `${familyMarker.size}px`
            }
          })
        : null,
      families.map((family, index) => (
      categoryButton(family.key, family.label, family.content, delayFor(index))
    )))
  );
}
