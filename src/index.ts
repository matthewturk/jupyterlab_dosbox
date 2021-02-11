import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  ICommandPalette, MainAreaWidget
} from '@jupyterlab/apputils';

import { Widget } from '@lumino/widgets';

import { 
  DosFactory, DosMainFn
} from "js-dos";
import { DosFS } from 'js-dos/dist/typescript/js-dos-fs';

require("js-dos");

class DosboxWidget extends Widget {
  constructor() {
    super();

    this.addClass('dosbox-widget');

    this.canvas = document.createElement('canvas');
    this.node.appendChild(this.canvas);
  }

  readonly canvas: HTMLCanvasElement;
  main: DosMainFn;
  fs: DosFS;

  async onUpdateRequest() : Promise<void> {
    const Dos = (window as any).Dos as DosFactory;
    const dosLaunched = await Dos(this.canvas, {
      wdosboxUrl: "https://js-dos.com/6.22/current/wdosbox.js" 
    });
    // dosLaunched.fs.extract()
    this.fs = dosLaunched.fs;
    this.main = dosLaunched.main;
    dosLaunched.main();
  }

}


function activate(app: JupyterFrontEnd, palette: ICommandPalette) {
  const content = new DosboxWidget();
  const widget = new MainAreaWidget({ content });
  widget.id = 'dosbox';
  widget.title.label = 'DosBox Emulator';
  widget.title.closable = true;
  const commandRun: string = 'dosbox:open';
  app.commands.addCommand(commandRun, {
    label: 'Run DosBox',
    execute: () => {
      if (!widget.isAttached) {
        // Attach the widget to the main work area if it's not there
        app.shell.add(widget, 'main');
      }
      content.update();
      // Activate the widget
      app.shell.activateById(widget.id);
    }
  });
  // Add the command to the palette.

  const commandExtract: string = 'dosbox:extract';
  app.commands.addCommand(commandExtract, {
    label: 'Extract File',
    execute: () => {
      if (!widget.content.fs) {
        return;
      }
      console.log("Extracting...");
      widget.content.fs.extract(
        "https://js-dos.com/6.22/current/test/digger.zip",
        "/game"
      ).then(() => {
        console.log("Extracted.")
      }
      ).catch((err) => console.log("UH OH", err));
    }
  });

  palette.addItem({ command: commandRun, category: 'Tutorial' });
  palette.addItem({ command: commandExtract, category: 'Tutorial' });

  /*Dos(document.getElementById("jsdos"), {
    wdosboxUrl: "https://js-dos.com/6.22/current/wdosbox.js"
  }).ready((fs, main) => {
    fs.extract("https://js-dos.com/6.22/current/test/digger.zip").then(() => {
      main(["-c", "DIGGER.COM"])
    });
  });*/
}

/**
 * Initialization data for the jupyterlab_dosbox extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
    id: 'jupyterlab_dosbox:plugin',
    autoStart: true,
    requires: [ICommandPalette],
    activate: activate
};

export default extension;
