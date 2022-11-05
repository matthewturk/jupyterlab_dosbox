import { Widget } from '@lumino/widgets';
import { CommandInterface, Emulators } from 'emulators';
import { DosInstance } from 'emulators-ui/dist/types/js-dos';
import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { DosFactoryType } from 'emulators-ui/dist/types/js-dos';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulators = await import('emulators');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulatorsUi = await import('emulators-ui');

declare const Dos: DosFactoryType;
declare const emulators: Emulators;

export class DosboxWidget extends Widget {
  constructor() {
    super();
    this.dosInitialized = false;
    emulators.pathPrefix = '/jupyterlab_dosbox/wasm/';

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
      'jupyterlab_dosbox',
      'bundles',
      'null_bundle.jsdos'
    );
    this.dos = Dos(this.dosDiv, { emulatorFunction: 'dosboxDirect' });
    this.ci = await this.dos.run(requestUrl);
    this.dosInitialized = true;
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
