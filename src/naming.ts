/*
 * Where a new drawing lands and what it is called. Kept pure so both rules can be
 * tested without Obsidian: the folder falls back to the note's own folder, and the
 * name keeps the timestamp that makes collisions unlikely.
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
}

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

export function drawingName(now: Date, naming: DrawingNaming): string {
  const pad = (value: number): string => value.toString().padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  const prefix = naming.prefix.trim().replace(/^\/+|\/+$/g, "");
  return prefix ? `${prefix} ${stamp}` : stamp;
}
