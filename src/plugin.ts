import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { IJupyterWidgetRegistry } from '@jupyter-widgets/base';
import { IDocumentManager } from '@jupyterlab/docmanager';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { ICommandPalette, MainAreaWidget } from '@jupyterlab/apputils';

import { DosboxWidget } from './standalone';

import {
  DosboxRuntimeModelAbs,
  DosboxRuntimeView,
  IAppInfo,
  DosboxCoreDumpModel,
  DosboxCoreDumpView
} from './widget';

import { MODULE_NAME, MODULE_VERSION } from './version';
const EXTENSION_ID = MODULE_NAME + ':plugin';

import { EmscriptenDrive } from './contents';
import { dosIcon } from './icon';

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
      DosboxRuntimeView,
      DosboxCoreDumpModel,
      DosboxCoreDumpView
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
        const drive = new EmscriptenDrive(
          (content.ci as any).module.FS,
          (content.ci as any).module._rescanFilesystem
        );
        manager.services.contents.addDrive(drive);
        const browser = factory.createFileBrowser('EMFS' + content.id, {
          driveName: drive.name
        });
        browser.title.caption = 'EmscriptenFS';
        browser.title.icon = dosIcon;
        app.shell.add(browser, 'left', { rank: 101 });
      });
    }
  });
  // Add the command to the palette.
  palette.addItem({ command: commandRun, category: 'Tutorial' });
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
