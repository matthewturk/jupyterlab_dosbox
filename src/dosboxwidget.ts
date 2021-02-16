import { Widget } from '@lumino/widgets';

import { CommandInterface } from 'emulators';
import { DosFactoryType, DosInstance } from 'emulators-ui/dist/types/js-dos';

import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { EmulatorsUi } from 'emulators-ui';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulators = await import('emulators');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulatorsUi = await import('emulators-ui');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
//const _wworker = await import('emulators/dist/wworker');

declare const Dos: DosFactoryType;

export class DosboxWidget extends Widget {
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
    const settings = ServerConnection.makeSettings();
    const requestUrl = URLExt.join(
      settings.baseUrl,
      'jupyterlab_dosbox', // API Namespace
      'get_example',
      'a1.jsdos'
    );
    this.dos = Dos(this.dosDiv, { emulatorFunction: 'dosWorker' });
    this.ci = await this.dos.run(requestUrl);
    this.ci.screenshot();
  }

  readonly dosDiv: HTMLDivElement;
  dosInitialized: boolean;
  dos: DosInstance;
  ci: CommandInterface;

  async onUpdateRequest(): Promise<void> {
    if (this.dosInitialized) {
      return;
    }
    this.dosInitialized = true;
    console.log('Creating a new Dos instance');
    this.startDos();
  }
}
