import { App, PluginSettingTab, Setting, type TextComponent, type ToggleComponent } from "obsidian";
import type JustSimpleExcalidrawPlugin from "../main";
import { t } from "./i18n";

/**
 * One option (the dot grid) plus the build that is actually loaded, so an update
 * that did not land is visible at a glance.
 */
export class JustSimpleExcalidrawSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: JustSimpleExcalidrawPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Just Simple Excalidraw" });

    new Setting(containerEl)
      .setName(t("dotGrid"))
      .setDesc(t("dotGridDesc"))
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.dotGrid);
        toggle.onChange((value: boolean) => {
          this.plugin.settings.dotGrid = value;
          void this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t("drawingFolder"))
      .setDesc(t("drawingFolderDesc"))
      .addText((text: TextComponent) => {
        text
          .setPlaceholder(t("drawingFolderPlaceholder"))
          .setValue(this.plugin.settings.drawingFolder)
          .onChange((value: string) => {
            this.plugin.settings.drawingFolder = value;
            void this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName(t("drawingPrefix"))
      .setDesc(t("drawingPrefixDesc"))
      .addText((text: TextComponent) => {
        text
          .setPlaceholder(t("drawingPrefixPlaceholder"))
          .setValue(this.plugin.settings.drawingPrefix)
          .onChange((value: string) => {
            this.plugin.settings.drawingPrefix = value;
            void this.plugin.saveSettings();
          });
      });

    containerEl.createEl("p", { text: `${t("settingsVersion")}: ${this.plugin.manifest.version}` });
    containerEl.createEl("p", {
      text: t("settingsBody")
    });
  }
}
