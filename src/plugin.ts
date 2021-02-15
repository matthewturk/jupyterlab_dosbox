import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import * as dosboxWidgetExports from './dosboxwidget';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

function activate(app: JupyterFrontEnd, palette: ICommandPalette): void {
  const content = new dosboxWidgetExports.DosboxWidget();
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
const dosboxPlugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_dosbox:plugin',
  autoStart: true,
  requires: [ICommandPalette],
  activate: activate
};

export default dosboxPlugin;
