import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IJupyterWidgetRegistry } from '@jupyter-widgets/base';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { DosboxWidget } from './standalone';

import { DosboxRuntimeModelAbs, DosboxRuntimeView, IAppInfo } from './widget';

import { MODULE_NAME, MODULE_VERSION } from './version';
const EXTENSION_ID = MODULE_NAME + ':plugin';

import { EmscriptenDrive } from './contents';

async function activate(
  app: JupyterFrontEnd,
  palette: ICommandPalette,
  registry: IJupyterWidgetRegistry,
  manager: IDocumentManager,
  factory: IFileBrowserFactory
): Promise<void> {
  const content = new DosboxWidget();
  const widget = new MainAreaWidget({ content });
  widget.id = 'dosbox';
  widget.title.label = 'DosBox Emulator';
  widget.title.closable = true;

  console.log('Registered ' + MODULE_NAME + ' ' + MODULE_VERSION);
  const DosboxRuntimeModel = class extends DosboxRuntimeModelAbs {
    getAppInfo(): IAppInfo {
      return { app, manager, factory };
    }
  };
  registry.registerWidget({
    name: MODULE_NAME,
    version: MODULE_VERSION,
    exports: {
      DosboxRuntimeModel,
      DosboxRuntimeView
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
      content.startDos().then(() => {
        const drive = new EmscriptenDrive((content.ci as any).module.FS);
        manager.services.contents.addDrive(drive);
        const browser = factory.createFileBrowser('EMFS' + content.id, {
          driveName: drive.name
        });
        browser.title.caption = 'EmscriptenFS';
        app.shell.add(browser, 'left', { rank: 101 });
      });
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
  requires: [
    ICommandPalette,
    IJupyterWidgetRegistry,
    IDocumentManager,
    IFileBrowserFactory
  ],
  activate: activate
};

export default dosboxPlugin;
