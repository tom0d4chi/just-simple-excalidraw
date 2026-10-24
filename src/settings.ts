import {
  AbstractInputSuggest,
  App,
  PluginSettingTab,
  Setting,
  TFolder,
  type TextComponent,
  type ToggleComponent
} from "obsidian";
import type { DrawingFolderMode } from "./naming";
import type JustSimpleExcalidrawPlugin from "../main";
import { t } from "./i18n";
import { drawingName } from "./naming";

/** Suggests the vault's existing folders while the path is typed, like Obsidian does. */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    private readonly input: HTMLInputElement,
    private readonly onPick: (path: string) => void
  ) {
    super(app, input);
  }

  getSuggestions(query: string): TFolder[] {
    const needle = query.trim().toLowerCase();
    return this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .filter((folder) => folder.path.toLowerCase().includes(needle))
      .slice(0, 50);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.onPick(folder.path);
    this.close();
  }
}

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

    containerEl.createEl("h2", { text: this.plugin.manifest.name });

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
      .setName(t("fitOnOpen"))
      .setDesc(t("fitOnOpenDesc"))
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.fitOnOpen);
        toggle.onChange((value: boolean) => {
          this.plugin.settings.fitOnOpen = value;
          void this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName(t("drawingFolder"))
      .setDesc(t("drawingFolderDesc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("note", t("drawingFolderNote"))
          .addOption("vault", t("drawingFolderVault"))
          .addOption("fixed", t("drawingFolderFixed"))
          .setValue(this.plugin.settings.drawingFolderMode)
          .onChange((value: string) => {
            this.plugin.settings.drawingFolderMode = value as DrawingFolderMode;
            void this.plugin.saveSettings();
            this.display();
          });
      });

    if (this.plugin.settings.drawingFolderMode === "fixed") {
      new Setting(containerEl)
        .setName(t("drawingFolderPath"))
        .setDesc(t("drawingFolderPathDesc"))
        .addText((text: TextComponent) => {
          const commit = (value: string): void => {
            this.plugin.settings.drawingFolder = value;
            void this.plugin.saveSettings();
          };
          text
            .setPlaceholder(t("drawingFolderPlaceholder"))
            .setValue(this.plugin.settings.drawingFolder)
            .onChange(commit);
          new FolderSuggest(this.app, text.inputEl, (path: string) => {
            text.setValue(path);
            commit(path);
          });
        });
    }

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

    new Setting(containerEl)
      .setName(t("snapToGrid"))
      .setDesc(t("snapToGridDesc"))
      .addToggle((toggle: ToggleComponent) => {
        toggle.setValue(this.plugin.settings.snapToGrid);
        toggle.onChange((value: boolean) => {
          this.plugin.settings.snapToGrid = value;
          void this.plugin.saveSettings();
        });
      });

    const previewEl = containerEl.createEl("p", { cls: "setting-item-description" });
    const refreshPreview = (): void => {
      const name = drawingName(new Date(), {
        prefix: this.plugin.settings.drawingPrefix,
        suffix: this.plugin.settings.drawingSuffix,
        folder: this.plugin.settings.drawingFolder,
        dateFormat: this.plugin.settings.drawingDateFormat
      });
      previewEl.setText(`${t("drawingNamePreview")}: ${name}.board`);
    };

    new Setting(containerEl)
      .setName(t("drawingDateFormat"))
      .setDesc(t("drawingDateFormatDesc"))
      .addText((text: TextComponent) => {
        text
          .setPlaceholder("YYYY-MM-DD HH.mm.ss")
          .setValue(this.plugin.settings.drawingDateFormat)
          .onChange((value: string) => {
            this.plugin.settings.drawingDateFormat = value;
            void this.plugin.saveSettings();
            refreshPreview();
          });
      });

    new Setting(containerEl)
      .setName(t("drawingSuffix"))
      .setDesc(t("drawingSuffixDesc"))
      .addText((text: TextComponent) => {
        text
          .setPlaceholder(t("drawingSuffixPlaceholder"))
          .setValue(this.plugin.settings.drawingSuffix)
          .onChange((value: string) => {
            this.plugin.settings.drawingSuffix = value;
            void this.plugin.saveSettings();
            refreshPreview();
          });
      });

    refreshPreview();

    containerEl.createEl("p", { text: `${t("settingsVersion")}: ${this.plugin.manifest.version}` });
    containerEl.createEl("p", {
      text: t("settingsBody")
    });
  }
}
