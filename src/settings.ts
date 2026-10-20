import { App, PluginSettingTab } from "obsidian";
import type JustSimpleExcalidrawPlugin from "../main";

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
    containerEl.createEl("p", { text: `Versión instalada: ${this.plugin.manifest.version}` });
    containerEl.createEl("p", {
      text: "La barra de herramientas está fija en el borde derecho, en vertical. Un arrastre desplaza el lienzo; un doble toque y arrastre selecciona."
    });
  }
}
