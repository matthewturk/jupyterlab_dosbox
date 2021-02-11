import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { Widget } from '@lumino/widgets';

import { DosFactory, DosMainFn } from 'js-dos';
import { DosFS } from 'js-dos/dist/typescript/js-dos-fs';

require('js-dos');

class DosboxWidget extends Widget {
  constructor() {
    super();
    this.dosInitialized = false;

    this.addClass('dosbox-widget');

    console.log('Creating a new canvas and appending.');
    this.canvas = document.createElement('canvas');
    this.node.appendChild(this.canvas);
  }

  readonly canvas: HTMLCanvasElement;
  main: DosMainFn;
  fs: DosFS;
  dosInitialized: boolean;

  async onUpdateRequest(): Promise<void> {
    if (this.dosInitialized) {
      return;
    }
    this.dosInitialized = true;
    const Dos = (window as any).Dos as DosFactory;
    const dosLaunched = await Dos(this.canvas, {
      wdosboxUrl: 'https://js-dos.com/6.22/current/wdosbox.js'
    });
    // dosLaunched.fs.extract()
    console.log('Creating a new Dos instance');
    this.fs = dosLaunched.fs;
    await this.fs.extract('https://caiiiycuk.github.io/dosify/digger.zip');
    this.main = dosLaunched.main;
    dosLaunched.main();
  }

  retrieveFile(filename: string): Uint8Array {
    return (this.fs as any).fs.readFile(filename);
  }

  writeFile(filename: string, data: string) {
      console.log("Writing ", filename, data);
      this.fs.createFile(filename, data);
  }
}

function activate(app: JupyterFrontEnd, palette: ICommandPalette): void {
  const content = new DosboxWidget();
  const widget = new MainAreaWidget({ content });
  widget.id = 'dosbox';
  widget.title.label = 'DosBox Emulator';
  widget.title.closable = true;

  const commandRetrieve = 'dosbox:retrieve';
  app.commands.addCommand(commandRetrieve, {
    label: 'Dosbox: Retrieve',
    execute: () => {
      if (!widget.content.fs) {
        return;
      }
      console.log('Attmepting to write');
      widget.content.writeFile('/example', 'hello there');
      console.log('Attempting to retrieve');
      const buffer: Uint8Array = widget.content.retrieveFile('/example');
      console.log(buffer);
    }
  });

  const commandRun = 'dosbox:open';
  app.commands.addCommand(commandRun, {
    label: 'Dosbox: Run',
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

  const commandExtract = 'dosbox:extract';
  app.commands.addCommand(commandExtract, {
    label: 'Dosbox: Extract File',
    execute: () => {
      if (!widget.content.fs) {
        return;
      }
      console.log('Extracting...');
      widget.content.fs
        .extract('https://js-dos.com/6.22/current/test/digger.zip', '/game')
        .then(() => {
          console.log('Extracted.');
        })
        .catch((err: any) => console.log('UH OH', err));
    }
  });

  palette.addItem({ command: commandRetrieve, category: 'Tutorial' });
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
