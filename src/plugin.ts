import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IJupyterWidgetRegistry } from '@jupyter-widgets/base';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { DosboxWidget } from './standalone';

import * as dosboxWidgetExports from './widget';

import { MODULE_NAME, MODULE_VERSION } from './version';
const EXTENSION_ID = MODULE_NAME + ':plugin';

async function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  registry: IJupyterWidgetRegistry
): Promise<void> {
  const content = new DosboxWidget();
  const widget = new MainAreaWidget({ content });
  widget.id = 'dosbox';
  widget.title.label = 'DosBox Emulator';
  widget.title.closable = true;

  console.log('Registered ' + MODULE_NAME + ' ' + MODULE_VERSION);
  registry.registerWidget({
    name: MODULE_NAME,
    version: MODULE_VERSION,
    exports: dosboxWidgetExports
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
const dosboxPlugin: JupyterFrontEndPlugin<void> = {
  id: EXTENSION_ID,
  autoStart: true,
  requires: [ICommandPalette, IJupyterWidgetRegistry],
  activate: activate
};

export default dosboxPlugin;
