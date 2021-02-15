import { Widget } from '@lumino/widgets';

import { CommandInterface } from 'emulators';
import { DosInstance } from 'emulators-ui/dist/types/js-dos';
import { EmulatorsUi } from 'emulators-ui';

const emulatorsUi = (EmulatorsUi as any).emulatorsUi;

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
    this.ui = emulatorsUi;
    this.dos = this.ui.dos(this.dosDiv);
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

  async onUpdateRequest(): Promise<void> {
    if (this.dosInitialized) {
      return;
    }
    this.dosInitialized = true;
    console.log('Creating a new Dos instance');
    this.startDos();
  }
}
