import { App, PluginSettingTab, Setting } from "obsidian";
import type JustSimpleExcalidrawPlugin from "../main";

export type ToolbarPosition = "bottom" | "right";

export interface JustSimpleExcalidrawSettings {
  toolbarPosition: ToolbarPosition;
}

export const DEFAULT_SETTINGS: JustSimpleExcalidrawSettings = {
  toolbarPosition: "bottom"
};

export function normalizeSettings(value: unknown): JustSimpleExcalidrawSettings {
  const stored = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    toolbarPosition: stored.toolbarPosition === "right" ? "right" : DEFAULT_SETTINGS.toolbarPosition
  };
}

export class JustSimpleExcalidrawSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: JustSimpleExcalidrawPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Posición de la barra de herramientas")
      .setDesc("Abajo en horizontal, como la barra de Obsidian en el móvil, o pegada al borde derecho en vertical.")
      .addDropdown((dropdown) => dropdown
        .addOption("bottom", "Abajo (horizontal)")
        .addOption("right", "Derecha (vertical)")
        .setValue(this.plugin.settings.toolbarPosition)
        .onChange(async (value) => {
          this.plugin.updateSettings({ toolbarPosition: value === "right" ? "right" : "bottom" });
          await this.plugin.saveSettings();
        }));
  }
}
