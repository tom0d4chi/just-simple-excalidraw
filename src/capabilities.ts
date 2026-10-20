/*
 * What can actually be changed on a given element. A line has no fill, a text has no
 * border, a freehand stroke has no line style: the menu only offers what will be visible,
 * so a tap never looks like it did nothing.
 */
export interface Capabilities {
  stroke: boolean;
  fill: boolean;
  width: boolean;
  style: boolean;
  corners: boolean;
  text: boolean;
}

const NONE: Capabilities = { stroke: false, fill: false, width: false, style: false, corners: false, text: false };

const BY_TYPE: Record<string, Capabilities> = {
  rectangle: { stroke: true, fill: true, width: true, style: true, corners: true, text: false },
  diamond: { stroke: true, fill: true, width: true, style: true, corners: true, text: false },
  ellipse: { stroke: true, fill: true, width: true, style: true, corners: false, text: false },
  line: { stroke: true, fill: false, width: true, style: true, corners: false, text: false },
  arrow: { stroke: true, fill: false, width: true, style: true, corners: false, text: false },
  freedraw: { stroke: true, fill: false, width: true, style: false, corners: false, text: false },
  text: { stroke: true, fill: false, width: false, style: false, corners: false, text: true },
  frame: { stroke: true, fill: false, width: true, style: false, corners: false, text: false }
};

export function capabilitiesForType(type: string): Capabilities {
  return BY_TYPE[type] ?? NONE;
}

/** Only what every selected element supports: a shared control for a mixed selection. */
export function capabilitiesForTypes(types: readonly string[]): Capabilities {
  if (types.length === 0) {
    return NONE;
  }
  return types.reduce<Capabilities>((acc, type) => {
    const next = capabilitiesForType(type);
    return {
      stroke: acc.stroke && next.stroke,
      fill: acc.fill && next.fill,
      width: acc.width && next.width,
      style: acc.style && next.style,
      corners: acc.corners && next.corners,
      text: acc.text && next.text
    };
  }, { stroke: true, fill: true, width: true, style: true, corners: true, text: true });
}

export function anyCapability(capabilities: Capabilities): boolean {
  return Object.values(capabilities).some(Boolean);
}

/**
 * The drawing defaults shown when nothing is selected. A tool that draws nothing — the
 * hand, the cursor, the eraser — has nothing to style, and the palette stays away.
 */
export function capabilitiesForTool(tool: string): Capabilities {
  if (tool === "text") {
    return { ...NONE, stroke: true, text: true };
  }
  if (tool === "freedraw") {
    return { ...NONE, stroke: true, width: true };
  }
  if (["rectangle", "diamond", "ellipse", "line", "arrow", "frame"].includes(tool)) {
    return { ...capabilitiesForType(tool) };
  }
  return { ...NONE };
}
