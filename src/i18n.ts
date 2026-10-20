/**
 * Interface strings follow Obsidian's own language, which it publishes through
 * moment's locale (it calls `moment.locale(lang)` at startup). Spanish was left
 * over from the plugin's upstream; French and English are provided too, and
 * anything unknown falls back to English.
 */

export type Language = "fr" | "en" | "es";

const DICTIONARIES = {
  fr: {
    selection: "Sélection multi",
    freedraw: "Crayon",
    eraser: "Gomme",
    hand: "Déplacer",
    rectangle: "Rectangle",
    diamond: "Losange",
    ellipse: "Ellipse",
    arrow: "Flèche",
    line: "Ligne",
    text: "Texte",
    image: "Image",
    shapes: "Formes",
    appearance: "Apparence",
    duplicate: "Dupliquer",
    remove: "Supprimer",
    editText: "Modifier le texte",
    undo: "Annuler",
    redo: "Rétablir",
    lockTool: "Verrouiller l'outil",
    unlockTool: "Déverrouiller l'outil",
    keepShape: "Garder la forme",
    stopKeepingShape: "Ne plus garder la forme",
    stroke: "Trait",
    fill: "Remplissage",
    thickness: "Épaisseur",
    lineStyle: "Style",
    corners: "Coins",
    size: "Taille",
    thin: "Fin",
    medium: "Moyen",
    thick: "Épais",
    solid: "Continu",
    dashed: "Tirets",
    dotted: "Pointillés",
    sharpCorners: "Coins droits",
    roundCorners: "Coins arrondis",
    noFill: "Sans remplissage",
    small: "Petit",
    normal: "Normal",
    large: "Grand",
    huge: "Énorme",
    colourStroke: "Trait",
    colourFill: "Remplissage",
    drawingFolder: "Dossier des nouveaux dessins",
    drawingFolderDesc: "Dossier du coffre où sont créés les dessins. Vide : à côté de la note en cours.",
    drawingFolderPlaceholder: "Excalidraw",
    drawingPrefix: "Préfixe des noms de fichier",
    drawingPrefixDesc: "Préfixe suivi de l'horodatage, par exemple « Drawing 2026-10-20 22.15.03 ». Vide : l'horodatage seul.",
    drawingPrefixPlaceholder: "Drawing",
    dotGrid: "Fond de points",
    dotGridDesc: "Dessine une grille de points à la place du quadrillage d'Excalidraw. Le fond suit le thème d'Obsidian.",
    settingsVersion: "Version installée",
    settingsBody: "La barre d'outils est fixée au bord droit, à la verticale. Sur mobile, un doigt utilise l'outil actif et deux doigts déplacent et zooment ; sur ordinateur, on déplace avec l'outil main."
  },
  en: {
    selection: "Multi-select",
    freedraw: "Pen",
    eraser: "Eraser",
    hand: "Pan",
    rectangle: "Rectangle",
    diamond: "Diamond",
    ellipse: "Ellipse",
    arrow: "Arrow",
    line: "Line",
    text: "Text",
    image: "Image",
    shapes: "Shapes",
    appearance: "Appearance",
    duplicate: "Duplicate",
    remove: "Delete",
    editText: "Edit text",
    undo: "Undo",
    redo: "Redo",
    lockTool: "Lock tool",
    unlockTool: "Unlock tool",
    keepShape: "Keep the shape",
    stopKeepingShape: "Stop keeping the shape",
    stroke: "Stroke",
    fill: "Fill",
    thickness: "Thickness",
    lineStyle: "Line style",
    corners: "Corners",
    size: "Size",
    thin: "Thin",
    medium: "Medium",
    thick: "Thick",
    solid: "Solid",
    dashed: "Dashed",
    dotted: "Dotted",
    sharpCorners: "Sharp corners",
    roundCorners: "Rounded corners",
    noFill: "No fill",
    small: "Small",
    normal: "Normal",
    large: "Large",
    huge: "Huge",
    colourStroke: "Stroke",
    colourFill: "Fill",
    drawingFolder: "Folder for new drawings",
    drawingFolderDesc: "Vault folder where drawings are created. Empty: beside the current note.",
    drawingFolderPlaceholder: "Excalidraw",
    drawingPrefix: "File name prefix",
    drawingPrefixDesc: "Prefix followed by the timestamp, for example “Drawing 2026-10-20 22.15.03”. Empty: the timestamp alone.",
    drawingPrefixPlaceholder: "Drawing",
    dotGrid: "Dot grid",
    dotGridDesc: "Draws a dot grid instead of Excalidraw's ruled grid. The background follows Obsidian's theme.",
    settingsVersion: "Installed version",
    settingsBody: "The toolbar is fixed to the right edge, vertically. On mobile one finger uses the active tool and two fingers pan and zoom; on desktop you pan with the hand tool."
  },
  es: {
    selection: "Selección múltiple",
    freedraw: "Dibujo a mano",
    eraser: "Borrador",
    hand: "Desplazar",
    rectangle: "Rectángulo",
    diamond: "Rombo",
    ellipse: "Elipse",
    arrow: "Flecha",
    line: "Línea",
    text: "Texto",
    image: "Imagen",
    shapes: "Formas",
    appearance: "Apariencia",
    duplicate: "Duplicar",
    remove: "Eliminar",
    editText: "Editar texto",
    undo: "Deshacer",
    redo: "Rehacer",
    lockTool: "Bloquear herramienta",
    unlockTool: "Desbloquear herramienta",
    keepShape: "Fijar la forma",
    stopKeepingShape: "Desbloquear la forma",
    stroke: "Trazo",
    fill: "Fondo",
    thickness: "Grosor",
    lineStyle: "Estilo",
    corners: "Bordes",
    size: "Texto",
    thin: "Fino",
    medium: "Medio",
    thick: "Grueso",
    solid: "Sólido",
    dashed: "Discontinuo",
    dotted: "Punteado",
    sharpCorners: "Esquinas rectas",
    roundCorners: "Esquinas redondeadas",
    noFill: "Sin relleno",
    small: "Pequeño",
    normal: "Normal",
    large: "Grande",
    huge: "Enorme",
    colourStroke: "Trazo",
    colourFill: "Fondo",
    drawingFolder: "Carpeta de los dibujos nuevos",
    drawingFolderDesc: "Carpeta del cofre donde se crean los dibujos. Vacío: junto a la nota actual.",
    drawingFolderPlaceholder: "Excalidraw",
    drawingPrefix: "Prefijo de los nombres de archivo",
    drawingPrefixDesc: "Prefijo seguido de la marca de tiempo, por ejemplo «Drawing 2026-10-20 22.15.03». Vacío: solo la marca de tiempo.",
    drawingPrefixPlaceholder: "Drawing",
    dotGrid: "Fondo de puntos",
    dotGridDesc: "Dibuja una cuadrícula de puntos en lugar de la retícula de Excalidraw. El fondo sigue el tema de Obsidian.",
    settingsVersion: "Versión instalada",
    settingsBody: "La barra de herramientas está fija en el borde derecho, en vertical. En el móvil, un dedo usa la herramienta activa y dos dedos desplazan y hacen zoom; en el escritorio se arrastra con la herramienta de mano."
  }
} as const;

export type StringKey = keyof typeof DICTIONARIES.en;

function detectLanguage(): Language {
  let tag = "";
  try {
    const moment = (window as unknown as { moment?: { locale?: () => string } }).moment;
    if (typeof moment?.locale === "function") {
      tag = moment.locale() ?? "";
    }
  } catch {
    tag = "";
  }
  if (!tag && typeof navigator !== "undefined") {
    tag = navigator.language ?? "";
  }
  const short = tag.slice(0, 2).toLowerCase();
  if (short === "fr") {
    return "fr";
  }
  if (short === "es") {
    return "es";
  }
  return "en";
}

const language = detectLanguage();

export const languageTag: Language = language;

export function t(key: StringKey): string {
  return DICTIONARIES[language][key] ?? DICTIONARIES.en[key];
}
