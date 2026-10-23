/*
 * Where a new drawing lands and what it is called. Kept pure so both rules can be
 * tested without Obsidian: the folder falls back to the note's own folder, and the
 * name is built from a prefix, a date stamp and a suffix.
 */
/** Where new drawings go: the vault root, the note's folder, or a fixed folder. */
export type DrawingFolderMode = "vault" | "note" | "fixed";

export interface DrawingNaming {
  /** Chosen location, see DrawingFolderMode. */
  mode?: DrawingFolderMode;
  /** Vault-relative folder used by "fixed"; ignored otherwise. */
  folder: string;
  /** Prefix for the file name, empty for no prefix. */
  prefix: string;
  /** Text appended after the date stamp, empty for none. */
  suffix?: string;
  /** Stamp pattern; supports YYYY MM DD HH mm ss. Empty leaves the stamp out. */
  dateFormat?: string;
}

export const DEFAULT_DATE_FORMAT = "YYYY-MM-DD HH.mm.ss";
/** Characters a file name cannot hold on the platforms Obsidian runs on. */
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/g;

export function drawingFolder(naming: DrawingNaming, noteFolder: string): string {
  const mode = naming.mode ?? "note";
  if (mode === "vault") {
    return "";
  }
  if (mode === "note") {
    return noteFolder;
  }
  const folder = naming.folder.trim().replace(/^\/+|\/+$/g, "");
  return folder || noteFolder;
}

/** Fills the pattern with the date's parts; unknown tokens are left as they are. */
export function formatStamp(now: Date, format: string): string {
  const pad = (value: number): string => value.toString().padStart(2, "0");
  return format
    .replace(/YYYY/g, String(now.getFullYear()))
    .replace(/MM/g, pad(now.getMonth() + 1))
    .replace(/DD/g, pad(now.getDate()))
    .replace(/HH/g, pad(now.getHours()))
    .replace(/mm/g, pad(now.getMinutes()))
    .replace(/ss/g, pad(now.getSeconds()));
}

/** Anything the file system would refuse is replaced rather than dropped. */
export function safeName(name: string): string {
  return name
    .replace(FORBIDDEN, "-")
    .replace(/-{2,}/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 120);
}

export function drawingName(now: Date, naming: DrawingNaming): string {
  const format = naming.dateFormat ?? DEFAULT_DATE_FORMAT;
  const stamp = format.trim() ? formatStamp(now, format) : "";
  const parts = [naming.prefix, stamp, naming.suffix ?? ""]
    .map((part) => part.trim())
    .filter(Boolean);
  const name = safeName(parts.join(" "));
  // A pattern of separators alone can sanitise down to nothing: fall back to the stamp.
  return name || formatStamp(now, DEFAULT_DATE_FORMAT);
}
