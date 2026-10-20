import { App, PluginSettingTab } from "obsidian";
import type JustSimpleExcalidrawPlugin from "../main";
import { t } from "./i18n";

/**
 * No user options: the toolbar is fixed to the right edge. This tab only
 * reports which build is actually loaded, so an update that did not land is
 * visible at a glance.
 */
export class JustSimpleExcalidrawSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: JustSimpleExcalidrawPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Just Simple Excalidraw" });
    containerEl.createEl("p", { text: `${t("settingsVersion")}: ${this.plugin.manifest.version}` });
    containerEl.createEl("p", {
      text: t("settingsBody")
    });
  }
}
