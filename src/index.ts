import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { Widget } from '@lumino/widgets';

import { Build } from 'emulators/dist/types/build';
import { CommandInterface } from 'emulators';
import { EmulatorsUi } from 'emulators-ui';
import { DosInstance } from 'js-dos';

class DosboxWidget extends Widget {
  constructor() {
    super();
    this.dosInitialized = false;

    this.addClass('dosbox-widget');

    console.log('Creating a new canvas and appending.');
    this.dosDiv = document.createElement('div');
    this.dosDiv.setAttribute('id', 'dos-' + this.id);
    this.node.appendChild(this.dosDiv);
  }

  async startDos(): Promise<void> {
    this.ui = new EmulatorsUi();
    this.dos = new DosInstance(this.dosDiv);
      console.log(Build);
    this.ci = await this.dos.run(
      'https://doszone-uploads.s3.dualstack.eu-central-1.amazonaws.com/original/2X/9/9ed7eb9c2c441f56656692ed4dc7ab28f58503ce.jsdos'
    );
    this.ci.screenshot();
  }

  readonly dosDiv: HTMLDivElement;
  dosInitialized: boolean;
  dos: DosInstance;
  ci: CommandInterface;
  ui: EmulatorsUi;
  rv: any;

  async onUpdateRequest(): Promise<void> {
    if (this.dosInitialized) {
      return;
    }
    this.dosInitialized = true;
    console.log('Creating a new Dos instance');
    this.startDos();
  }
}

function activate(app: JupyterFrontEnd, palette: ICommandPalette): void {
  const content = new DosboxWidget();
  const widget = new MainAreaWidget({ content });
  widget.id = 'dosbox';
  widget.title.label = 'DosBox Emulator';
  widget.title.closable = true;

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

  palette.addItem({ command: commandRun, category: 'Tutorial' });

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
