import { Widget } from '@lumino/widgets';

import { CommandInterface } from 'emulators';
import { DosFactoryType, DosInstance } from 'emulators-ui/dist/types/js-dos';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulators = await import('emulators');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulatorsUi = await import('emulators-ui');

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
    this.dos = Dos(this.dosDiv);
    this.ci = await this.dos.run(
      'https://doszone-uploads.s3.dualstack.eu-central-1.amazonaws.com/original/2X/9/9ed7eb9c2c441f56656692ed4dc7ab28f58503ce.jsdos'
    );
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
