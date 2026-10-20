import { FileView, Notice, Platform, Plugin, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { createElement, useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Excalidraw,
  serializeAsJSON,
  THEME
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
  ExcalidrawImperativeAPI
} from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { CanvasToolbar } from "./src/toolbar";
import { trackBottomUiInset } from "./src/layout";
import type { StyleState } from "./src/appearance";
import { JustSimpleExcalidrawSettingTab } from "./src/settings";
import { attachInteraction } from "./src/interaction";
import { drawingFolder, drawingName, type DrawingFolderMode } from "./src/naming";
import { capabilitiesForTool, capabilitiesForTypes, anyCapability } from "./src/capabilities";
import { anyElementUnder } from "./src/overlap";
import { snapElements } from "./src/snap";
import { keepViewportInSync } from "./src/viewport";

const VIEW_TYPE_EXCALIDRAW = "just-simple-excalidraw-view";
const AUTOSAVE_DELAY_MS = 750;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type SceneSnapshot = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

type PendingSave = {
  file: TFile;
  snapshot: SceneSnapshot;
};

type StoredScene = ExcalidrawInitialDataState & {
  files?: BinaryFiles;
};

type ExcalidrawCanvasProps = Omit<ComponentProps<typeof Excalidraw>, "initialData"> & {
  initialData: StoredScene;
  dotGrid?: boolean;
  snapToGrid?: boolean;
  /** Read live: the setting can change while the drawing is open. */
  shouldSnapToGrid?: () => boolean;
};

/*
 * Touch and mouse need different defaults. With a finger, one finger acts and
 * two pan (Excalidraw's multi-touch gesture), so the selection tool is the base
 * tool: a drag on empty canvas draws a marquee, a drag on a shape moves it, and
 * nothing has to be switched to pan. With a mouse there is no second finger, so
 * the hand tool stays the default and dragging pans.
 */
function defaultActiveTool(isTouchDevice: boolean): AppState["activeTool"] {
  return {
    // A finger drag pans. The marquee only appears once the cursor tool is
    // picked, so the sheet behaves like paper until asked otherwise.
    type: "hand",
    customType: null,
    locked: false,
    lastActiveTool: null
  };
}

function emptyScene(): StoredScene {
  return { elements: [], appState: {}, files: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredScene(value: unknown): value is StoredScene {
  if (!isRecord(value)) {
    return false;
  }

  const { elements, appState, files } = value;
  return Array.isArray(elements) && elements.every((element) =>
    isRecord(element) && typeof element.id === "string" && typeof element.type === "string"
  ) && isRecord(appState) && (files === undefined || (
    isRecord(files) && Object.values(files).every((file) =>
      isRecord(file) && typeof file.id === "string" && typeof file.mimeType === "string" && typeof file.dataURL === "string"
    )
  ));
}

function imageByteLength(dataURL: string): number {
  const commaIndex = dataURL.indexOf(",");
  const payloadLength = commaIndex === -1 ? dataURL.length : dataURL.length - commaIndex - 1;
  return Math.floor((payloadLength * 3) / 4);
}



/**
 * Scenes saved by older versions (or by Excalidraw itself) may not carry an
 * `activeTool`, and Excalidraw would then fall back to the selection tool. The
 * hand tool is the default here, so it is re-applied on every load.
 */
function withDefaultTool(scene: StoredScene, isTouchDevice: boolean): StoredScene {
  return {
    ...scene,
    appState: {
      ...scene.appState,
      activeTool: defaultActiveTool(isTouchDevice),
      // Excalidraw paints its grid into the canvas bitmap, where no stylesheet can
      // touch it. The plugin draws a dot grid on the sheet instead, so its own
      // grid is kept off and the canvas is left transparent for it to show.
      gridModeEnabled: false,
      viewBackgroundColor: "transparent"
    }
  };
}

function ExcalidrawCanvas({ initialData, dotGrid = true, snapToGrid = false, shouldSnapToGrid, ...props }: ExcalidrawCanvasProps) {
  // Declared before any hook that could run immediately (the test harness calls effects
  // eagerly), so nothing reaches a ref that has not been initialised yet.
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const contentUnderScheduled = useRef(false);
  // Level to come back to when a double tap zooms back out.
  const zoomBaseRef = useRef(1);
  const [theme, setTheme] = useState<typeof THEME.LIGHT | typeof THEME.DARK>(THEME.LIGHT);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);
  const isTouchDevice = Platform.isMobile;
  const [activeTool, setActiveTool] = useState<AppState["activeTool"]>(() => defaultActiveTool(isTouchDevice));
  const [style, setStyle] = useState<StyleState>({
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    strokeWidth: 2,
    strokeStyle: "solid",
    fillStyle: "hachure",
    fontSize: 20,
    roundness: null
  });
  const styleSignatureRef = useRef("");
  const [selectionCount, setSelectionCount] = useState(0);
  const selectionCountRef = useRef(0);
  const [textSelected, setTextSelected] = useState(false);
  const [capabilities, setCapabilities] = useState(capabilitiesForTool("hand"));
  const [contentUnder, setContentUnder] = useState(false);
  const capabilitySignatureRef = useRef(JSON.stringify(capabilitiesForTool("hand")));
  const textSelectedRef = useRef(false);
  const [selectionArmed, setSelectionArmed] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const canRedoRef = useRef(false);
  const manualSelectionRef = useRef(false);
  const selectionArmedRef = useRef(false);
  const cancelMarqueeRef = useRef<(() => void) | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const excalidrawElementRef = useRef<HTMLElement | null>(null);
  const activeToolRef = useRef(activeTool);

  useEffect(() => {
    const updateTheme = (): void => setTheme(document.body.classList.contains("theme-dark") ? THEME.DARK : THEME.LIGHT);
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Excalidraw's root element inside this view: the element whose position is
  // used to translate pointer events into scene coordinates.
  const getCanvasElement = useCallback((): HTMLElement | null => {
    const cached = excalidrawElementRef.current;
    if (cached && cached.isConnected) {
      return cached;
    }
    const found = canvasHostRef.current?.querySelector<HTMLElement>(".excalidraw") ?? null;
    excalidrawElementRef.current = found;
    return found;
  }, []);

  useEffect(() => {
    if (!api) {
      return;
    }
    return keepViewportInSync(api, getCanvasElement);
  }, [api, getCanvasElement]);

  useEffect(() => {
    const root = rootRef.current;
    return root ? trackBottomUiInset(root) : undefined;
  }, []);

  /*
   * One finger, one decision per gesture. The hand ignores taps, so the gesture is
   * hit-tested as the finger lands:
   *   - on an element: it is selected and the selection tool is armed, which is
   *     what lets Excalidraw move it under the finger;
   *   - on empty paper: the hand takes over, so the drag pans instead of drawing a
   *     marquee — unless the cursor was armed by its button, in which case the
   *     marquee is exactly what was asked for.
   * A tap on empty paper still hands the sheet back to the hand.
   */
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host || !api) {
      return undefined;
    }
    const interaction = attachInteraction({
      host,
      api,
      armed: () => selectionArmedRef.current,
      setArmed: (next) => {
        selectionArmedRef.current = next;
        setSelectionArmed(next);
      },
      onMarqueeCancel: (cancel) => {
        cancelMarqueeRef.current = cancel;
      },
      snapping: () => ((shouldSnapToGrid?.() ?? snapToGrid) ? api.getAppState().gridSize || 20 : 0),
      /*
       * Double tap on empty paper toggles the zoom around the point touched: in to 2x,
       * back out to the level that was there before — the way a photo behaves.
       */
      onDoubleTap: (scene) => {
        if (!api) {
          return false;
        }
        const state = api.getAppState();
        if (state.activeTool.type !== "hand" && state.activeTool.type !== "selection") {
          return false;
        }
        const canvas = typeof document?.querySelector === "function"
          ? document.querySelector<HTMLElement>(".excalidraw__canvas.interactive")
            ?? document.querySelector<HTMLElement>(".excalidraw__canvas")
          : null;
        if (!canvas) {
          return false;
        }
        const zoom = state.zoom.value || 1;
        const target = zoom > 1.05 ? zoomBaseRef.current : 2;
        if (zoom <= 1.05) {
          zoomBaseRef.current = zoom;
        }
        // Keep the scene point under the same place on screen.
        const rect = canvas.getBoundingClientRect();
        const clientX = rect.left + (scene.x + state.scrollX) * zoom;
        const clientY = rect.top + (scene.y + state.scrollY) * zoom;
        api.updateScene({
          appState: {
            // Excalidraw brands its normalised zoom; the value is a plain number.
            zoom: { value: target as never },
            scrollX: (clientX - rect.left) / target - scene.x,
            scrollY: (clientY - rect.top) / target - scene.y
          }
        });
        return true;
      },
      onGestureEnd: (before) => {
        // Read at gesture time: toggling the setting must not need a reload.
        if (!(shouldSnapToGrid?.() ?? snapToGrid)) {
          return;
        }
        const elements = api.getSceneElements();
        const touched = new Set(elements.filter((element) => before.get(element.id) !== element.versionNonce).map((element) => element.id));
        const snap = snapElements(elements, api.getAppState().gridSize || 20, touched);
        if (snap.changed) {
          api.updateScene({ elements: snap.elements });
        }
      }
    });
    return () => {
      interaction.detach();
      cancelMarqueeRef.current = null;
    };
  }, [api]);


  /*
   * Excalidraw keeps its history private; the only honest window on it is its
   * own redo button, which is disabled exactly when the stack is empty. Read it
   * after the commit that follows a change.
   */
  /*
   * The cursor button is a mode of its own: armed only when pressed, so a drag on
   * empty paper draws a marquee. Selecting an element arms the selection tool
   * silently — it lets Excalidraw move the element — without lighting the button.
   */
  const toggleSelection = useCallback((): void => {
    setSelectionArmed((armed) => {
      const next = !armed;
      selectionArmedRef.current = next;
      api?.setActiveTool({ type: next ? "selection" : "hand", locked: false });
      return next;
    });
  }, [api]);

  /*
   * The column has no background of its own. It gets one only when a shape or an image
   * passes beneath it, where a bare icon would be unreadable. The same goes for the menus
   * that open from it.
   */
  const scheduleContentUnder = useCallback((): void => {
    if (contentUnderScheduled.current) {
      return;
    }
    contentUnderScheduled.current = true;
    const schedule = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 16);
    schedule(() => {
      contentUnderScheduled.current = false;
      const current = apiRef.current;
      if (!current || typeof document?.querySelectorAll !== "function") {
        return;
      }
      const panels = [
        ...document.querySelectorAll<HTMLElement>(".jse-tools"),
        ...document.querySelectorAll<HTMLElement>(".jse-shapes__menu:not(.is-closed)")
      ];
      const rects = panels
        .map((panel) => panel.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }));
      if (rects.length === 0) {
        return;
      }
      const state = current.getAppState();
      const canvas = document.querySelector<HTMLElement>(".excalidraw__canvas.interactive")
        ?? document.querySelector<HTMLElement>(".excalidraw__canvas");
      const origin = canvas?.getBoundingClientRect();
      setContentUnder(anyElementUnder(current.getSceneElements(), rects, {
        scrollX: state.scrollX,
        scrollY: state.scrollY,
        zoom: state.zoom.value || 1,
        originX: origin?.left ?? 0,
        originY: origin?.top ?? 0
      }));
    });
  }, []);

  const syncHistoryState = useCallback((): void => {
    const schedule = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(Date.now()), 16);
    schedule(() => {
      const button = typeof document.querySelector === "function"
        ? document.querySelector<HTMLButtonElement>('[data-testid="button-redo"]')
        : null;
      const next = button ? !button.disabled : false;
      if (next !== canRedoRef.current) {
        canRedoRef.current = next;
        setCanRedo(next);
      }
    });
  }, []);

  const handleChange = useCallback((elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles): void => {
    const nextTool = appState?.activeTool;
    const previousTool = activeToolRef.current;
    if (nextTool && (nextTool.type !== previousTool.type || nextTool.locked !== previousTool.locked)) {
      activeToolRef.current = nextTool;
      setActiveTool(nextTool);
    }
    const selectedElement = elements.find((element) => (
      !element.isDeleted && Object.hasOwn(appState?.selectedElementIds ?? {}, element.id)
    ));
    // With something selected the menu shows that element's style, not the
    // tool's defaults: the swatch you see lit is the one you are looking at.
    const nextStyle: StyleState = {
      strokeColor: selectedElement?.strokeColor ?? appState?.currentItemStrokeColor ?? "#1e1e1e",
      backgroundColor: selectedElement?.backgroundColor ?? appState?.currentItemBackgroundColor ?? "transparent",
      strokeWidth: selectedElement?.strokeWidth ?? appState?.currentItemStrokeWidth ?? 2,
      strokeStyle: selectedElement?.strokeStyle ?? appState?.currentItemStrokeStyle ?? "solid",
      fillStyle: selectedElement?.fillStyle ?? appState?.currentItemFillStyle ?? "hachure",
      fontSize: (selectedElement?.type === "text" ? selectedElement.fontSize : null)
        ?? appState?.currentItemFontSize ?? 20,
      roundness: selectedElement?.roundness?.type ?? null
    };
    const root = rootRef.current;
    if (root) {
      const scale = appState?.zoom?.value ?? 1;
      const size = (appState?.gridSize ?? 20) * scale;
      root.style.setProperty("--jse-dot-size", `${size}px`);
      root.style.setProperty("--jse-dot-x", `${(appState?.scrollX ?? 0) * scale}px`);
      root.style.setProperty("--jse-dot-y", `${(appState?.scrollY ?? 0) * scale}px`);
    }
    const signature = JSON.stringify(nextStyle);
    if (signature !== styleSignatureRef.current) {
      styleSignatureRef.current = signature;
      setStyle(nextStyle);
    }
    // A mode change ends any marquee still being drawn, and disarms the cursor:
    // neither may survive a switch to the pen, the eraser or a shape.
    if (nextTool && previousTool && nextTool.type !== previousTool.type) {
      cancelMarqueeRef.current?.();
    }
    if (activeToolRef.current.type !== "selection" && selectionArmedRef.current) {
      selectionArmedRef.current = false;
      setSelectionArmed(false);
    }
    const selectedIds = Object.keys(appState?.selectedElementIds ?? {});
    const selected = selectedIds.length;
    const previouslySelected = selectionCountRef.current;
    if (selected !== selectionCountRef.current) {
      selectionCountRef.current = selected;
      setSelectionCount(selected);
    }
    const onlyText = selected === 1 && elements.some(
      (element) => element.id === selectedIds[0] && element.type === "text" && !element.isDeleted
    );
    if (onlyText !== textSelectedRef.current) {
      textSelectedRef.current = onlyText;
      setTextSelected(onlyText);
    }
    // What the menu may offer: the selection's own limits, or the tool's defaults.
    const selectedTypes = elements
      .filter((element) => !element.isDeleted && Object.hasOwn(appState?.selectedElementIds ?? {}, element.id))
      .map((element) => element.type);
    const nextCapabilities = selectedTypes.length > 0
      ? capabilitiesForTypes(selectedTypes)
      : capabilitiesForTool(appState?.activeTool?.type ?? "hand");
    const capabilitySignature = JSON.stringify(nextCapabilities);
    if (capabilitySignature !== capabilitySignatureRef.current) {
      capabilitySignatureRef.current = capabilitySignature;
      setCapabilities(nextCapabilities);
    }

    syncHistoryState();
    scheduleContentUnder();
    props.onChange?.(elements, appState, files);
  }, [props.onChange, syncHistoryState]);

  useEffect(() => {
    syncHistoryState();
  }, [api, syncHistoryState]);

  return createElement("div", {
    className: `jse-root${dotGrid ? " has-dots" : ""}`,
    ref: rootRef
  },
    createElement("div", { className: "jse-canvas", ref: canvasHostRef },
      createElement(Excalidraw, {
        initialData: withDefaultTool(initialData ?? emptyScene(), isTouchDevice),
        theme,
        detectScroll: false,
        handleKeyboardGlobally: false,
        aiEnabled: false,
        validateEmbeddable: false,
        showDeprecatedFonts: false,
        UIOptions: {
          canvasActions: {
            clearCanvas: true,
            changeViewBackgroundColor: true,
            export: false,
            loadScene: false,
            saveToActiveFile: false,
            saveAsImage: false,
            toggleTheme: false
          },
          tools: { image: true }
        },
        generateIdForFile: (file: File): string => {
          if (file.size > MAX_IMAGE_BYTES) {
            throw new Error(`La imagen supera el límite de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
          }
          return crypto.randomUUID();
        },
        ...props,
        excalidrawAPI: setApi,
        onChange: handleChange
      })
    ),
    createElement(CanvasToolbar, {
      api,
      activeTool: activeTool.type,
      locked: activeTool.locked,
      style,
      selectionCount,
      textSelected,
      capabilities,
      contentUnder,
      dark: theme === THEME.DARK,
      onMenusToggled: scheduleContentUnder,
      selectionArmed,
      onToggleSelection: toggleSelection,
      canRedo,
      isTouchDevice,
      getCanvasElement
    })
  );
}

export interface JustSimpleExcalidrawSettings {
  dotGrid: boolean;
  /** Where new drawings go: vault root, the note's folder, or a fixed folder. */
  drawingFolderMode: DrawingFolderMode;
  /** Vault folder used by "fixed"; ignored by the other modes. */
  drawingFolder: string;
  /** Prefix for new file names; empty means the timestamp alone. */
  drawingPrefix: string;
  /** Round shapes onto the dot lattice when a gesture ends. */
  snapToGrid: boolean;
}

export default class JustSimpleExcalidrawPlugin extends Plugin {
  private readonly fileOwners = new Map<TFile, ExcalidrawView>();
  settings: JustSimpleExcalidrawSettings = {
    dotGrid: true,
    drawingFolderMode: "note",
    drawingFolder: "",
    drawingPrefix: "Drawing",
    snapToGrid: true
  };

  async onload(): Promise<void> {
    const stored = await this.loadData() as Partial<JustSimpleExcalidrawSettings> | null;
    const saved = stored as Partial<JustSimpleExcalidrawSettings> | null;
    this.settings = {
      dotGrid: true,
      // A folder typed in the previous version means the fixed mode: keep it.
      drawingFolderMode: saved?.drawingFolderMode ?? (saved?.drawingFolder ? "fixed" : "note"),
      drawingFolder: "",
      drawingPrefix: "Drawing",
      snapToGrid: true,
      ...(saved ?? {})
    };
    this.applyDotGrid();
    this.addSettingTab(new JustSimpleExcalidrawSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_EXCALIDRAW, (leaf) => new ExcalidrawView(leaf, this));
    this.registerExtensions(["excalidraw"], VIEW_TYPE_EXCALIDRAW);

    this.addCommand({
      id: "new-excalidraw-drawing",
      name: "Create new Excalidraw drawing",
      callback: () => void this.createDrawing()
    });
    this.addRibbonIcon("pencil-ruler", "Create new Excalidraw drawing", () => void this.createDrawing());
  }

  /** Live switch: the class is all the stylesheet needs. */
  applyDotGrid(): void {
    if (typeof document?.querySelectorAll !== "function") {
      return;
    }
    document.querySelectorAll(".jse-root").forEach((root) => {
      root.classList.toggle("has-dots", this.settings.dotGrid);
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.applyDotGrid();
  }

  async createDrawing(parentPath = ""): Promise<TFile> {
    const naming = {
      mode: this.settings.drawingFolderMode,
      folder: this.settings.drawingFolder,
      prefix: this.settings.drawingPrefix
    };
    const folder = drawingFolder(naming, parentPath);
    if (folder) {
      await this.ensureFolder(folder);
    }
    const baseName = drawingName(new Date(), naming);
    let sequence = 1;
    let path = normalizePath(`${folder ? `${folder}/` : ""}${baseName}.excalidraw`);

    while (this.app.vault.getAbstractFileByPath(path)) {
      sequence += 1;
      path = normalizePath(`${folder ? `${folder}/` : ""}${baseName} ${sequence}.excalidraw`);
    }

    const file = await this.app.vault.create(path, JSON.stringify({
      type: "excalidraw",
      version: 2,
      source: "just-simple-excalidraw",
      ...emptyScene()
    }, null, 2));
    await this.app.workspace.getLeaf("tab").openFile(file);
    return file;
  }

  /** Creates the folder and its parents when they do not exist yet. */
  private async ensureFolder(path: string): Promise<void> {
    const parts = path.split("/").filter(Boolean);
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        try {
          await this.app.vault.createFolder(current);
        } catch {
          // Raced with another creation, or the path is not a folder: the write will
          // report the real problem.
        }
      }
    }
  }

  claimFile(file: TFile, view: ExcalidrawView): boolean {
    const owner = this.fileOwners.get(file);
    if (owner && owner !== view) {
      return false;
    }
    this.fileOwners.set(file, view);
    return true;
  }

  getFileOwner(file: TFile): ExcalidrawView | null {
    return this.fileOwners.get(file) ?? null;
  }

  releaseFile(file: TFile, view: ExcalidrawView): void {
    if (this.fileOwners.get(file) === view) {
      this.fileOwners.delete(file);
    }
  }

  ownsFile(file: TFile, view: ExcalidrawView): boolean {
    return this.fileOwners.get(file) === view;
  }
}

class ExcalidrawView extends FileView {
  private root: Root | null = null;
  private autosaveTimer: number | null = null;
  private latestSnapshot: PendingSave | null = null;
  private activeFile: TFile | null = null;
  private ownsActiveFile = false;
  private loadGeneration = 0;
  private readonly writingFiles = new Set<TFile>();
  private externalChangeDetected = false;
  private readonly pendingSaves = new Set<Promise<void>>();
  private lastSavedDocument = new Map<TFile, string>();

  constructor(readonly leaf: WorkspaceLeaf, private readonly plugin: JustSimpleExcalidrawPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_EXCALIDRAW;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "Excalidraw";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("just-simple-excalidraw-view");
    this.root = createRoot(this.contentEl);
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof TFile && file === this.activeFile && !this.writingFiles.has(file)) {
        this.stopForExternalChange(file);
      }
    }));
  }

  async onLoadFile(file: TFile): Promise<void> {
    const loadGeneration = ++this.loadGeneration;
    const previousFile = this.activeFile;
    if (previousFile) {
      await this.flushSave(previousFile);
      if (previousFile !== file) {
        this.plugin.releaseFile(previousFile, this);
      }
    }

    const existingOwner = this.plugin.getFileOwner(file);
    if (existingOwner && existingOwner !== this) {
      this.activeFile = null;
      this.ownsActiveFile = false;
      this.externalChangeDetected = false;
      this.latestSnapshot = null;
      existingOwner.activate();
      this.leaf.detach();
      return;
    }

    this.activeFile = file;
    this.ownsActiveFile = this.plugin.claimFile(file, this);
    this.externalChangeDetected = false;
    this.latestSnapshot = null;
    this.recreateRoot();

    try {
      const parsed = JSON.parse(await this.app.vault.cachedRead(file)) as unknown;
      if (!this.isCurrentLoad(file, loadGeneration)) {
        return;
      }
      if (!isStoredScene(parsed)) {
        throw new Error("El archivo no contiene una escena Excalidraw válida.");
      }
      this.renderCanvas(file, parsed);
    } catch (error) {
      if (!this.isCurrentLoad(file, loadGeneration)) {
        return;
      }
      this.renderCorruptFileError(error instanceof Error ? error.message : "JSON inválido.");
    }
  }

  async onUnloadFile(file: TFile): Promise<void> {
    await this.flushSave(file);
    if (this.activeFile === file) {
      this.loadGeneration += 1;
      this.plugin.releaseFile(file, this);
      this.activeFile = null;
      this.ownsActiveFile = false;
      this.externalChangeDetected = false;
      this.unmountRoot();
    }
  }

  async onClose(): Promise<void> {
    await this.flushSave(this.activeFile);
    await Promise.all([...this.pendingSaves]);
    this.loadGeneration += 1;
    if (this.activeFile) {
      this.plugin.releaseFile(this.activeFile, this);
    }
    this.activeFile = null;
    this.ownsActiveFile = false;
    this.unmountRoot();
  }

  activate(): void {
    this.app.workspace.setActiveLeaf(this.leaf, { focus: true });
  }

  private isCurrentLoad(file: TFile, loadGeneration: number): boolean {
    return this.loadGeneration === loadGeneration && this.activeFile === file && this.file === file &&
      this.ownsActiveFile && this.plugin.ownsFile(file, this);
  }

  private recreateRoot(): void {
    this.unmountRoot();
    this.contentEl.empty();
    this.root = createRoot(this.contentEl);
  }

  private unmountRoot(): void {
    this.root?.unmount();
    this.root = null;
  }

  private renderCanvas(file: TFile, scene: StoredScene): void {
    if (!this.root) {
      return;
    }

    this.root.render(createElement(ExcalidrawCanvas, {
      key: file.path,
      initialData: scene,
      dotGrid: this.plugin.settings.dotGrid,
      shouldSnapToGrid: () => this.plugin.settings.snapToGrid,
      onPaste: (_data: unknown, event: ClipboardEvent | null): boolean => {
        const image = Array.from(event?.clipboardData?.files ?? []).find((file) => file.type.startsWith("image/"));
        if (image && image.size > MAX_IMAGE_BYTES) {
          new Notice(`La imagen supera el límite de ${MAX_IMAGE_BYTES / 1024 / 1024} MB y no se ha insertado.`);
          return true;
        }
        return false;
      },
      onChange: (elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles): void => {
        this.queueSave(file, { elements, appState, files });
      }
    }));
  }

  private renderCorruptFileError(message: string): void {
    this.unmountRoot();
    this.contentEl.empty();
    const panel = this.contentEl.createDiv({ cls: "just-simple-excalidraw-error" });
    panel.createEl("h3", { text: "No se puede abrir este dibujo" });
    panel.createEl("p", { text: "El JSON parece estar dañado. El archivo original no se ha modificado." });
    panel.createEl("pre", { text: message });
    const button = panel.createEl("button", { text: "Crear un lienzo vacío aparte" });
    button.addEventListener("click", () => {
      void this.plugin.createDrawing(this.file?.parent?.path ?? "");
    });
  }

  private queueSave(file: TFile, snapshot: SceneSnapshot): void {
    if (this.externalChangeDetected || !this.ownsActiveFile || file !== this.activeFile || file !== this.file ||
      !this.plugin.ownsFile(file, this)) {
      return;
    }

    const oversized = Object.values(snapshot.files).find((file) => imageByteLength(file.dataURL) > MAX_IMAGE_BYTES);
    if (oversized) {
      new Notice(`La imagen «${oversized.id}» supera el límite de ${MAX_IMAGE_BYTES / 1024 / 1024} MB. El dibujo no se guardará hasta retirarla.`);
      return;
    }

    this.latestSnapshot = { file, snapshot };
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = window.setTimeout(() => void this.flushSave(file), AUTOSAVE_DELAY_MS);
  }

  private async flushSave(file: TFile | null): Promise<void> {
    const pending = this.latestSnapshot;
    if (!file || !pending || pending.file !== file || (this.externalChangeDetected && file === this.activeFile)) {
      return;
    }

    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.latestSnapshot = null;
    const save = this.save(pending);
    this.pendingSaves.add(save);
    try {
      await save;
    } finally {
      this.pendingSaves.delete(save);
    }
  }

  private async save(pending: PendingSave): Promise<void> {
    this.writingFiles.add(pending.file);
    try {
      const document = serializeAsJSON(pending.snapshot.elements, pending.snapshot.appState, pending.snapshot.files, "local");
      if (this.lastSavedDocument.get(pending.file) === document) {
        return;
      }
      await this.app.vault.modify(pending.file, document);
      this.lastSavedDocument.set(pending.file, document);
    } catch (error) {
      if (pending.file === this.activeFile && pending.file === this.file && !this.externalChangeDetected) {
        this.latestSnapshot = pending;
      }
      new Notice(`No se pudo guardar el dibujo: ${error instanceof Error ? error.message : "error desconocido"}`);
    } finally {
      this.writingFiles.delete(pending.file);
    }
  }

  private stopForExternalChange(file: TFile): void {
    if (this.externalChangeDetected || file !== this.activeFile) {
      return;
    }
    this.externalChangeDetected = true;
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    new Notice("El archivo cambió fuera de esta vista. El autoguardado se ha detenido; cierra y vuelve a abrir la pestaña para cargar la versión nueva.", 0);
  }

}
