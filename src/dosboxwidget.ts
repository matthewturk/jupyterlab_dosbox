import { Widget } from '@lumino/widgets';
import { DOMWidgetModel, ISerializers, WidgetModel, unpack_models } from '@jupyter-widgets/base';
import { MODULE_NAME, MODULE_VERSION } from './version';

import { CommandInterface, Emulators } from 'emulators';
import { DosFactoryType, DosInstance } from 'emulators-ui/dist/types/js-dos';

import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
//import { EmulatorsUi } from 'emulators-ui';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulators = await import('emulators');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulatorsUi = await import('emulators-ui');

// eslint-disable-next-line @typescript-eslint/no-unused-vars
//const _wworker = await import('emulators/dist/wworker');

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
      'jupyterlab_dosbox', // API Namespace
      'bundles',
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

export class LateBindingEmulatorsUi extends EmulatorsUi {
      dos: DosFactoryType = (root: HTMLDivElement, options?: DosOptions) => {
        return new DosInstance(root, this, options || {});
    };
}

export class DosboxRuntimeModel extends DOMWidgetModel {
  defaults(): any {
    return {
      ...super.defaults(),
      _model_name: DosboxRuntimeModel.model_name,
      _model_module: DosboxRuntimeModel.model_module,
      _model_module_version: DosboxRuntimeModel.model_module_version
    };
  }

  initialize(attributes: any, options: any): void {
    super.initialize(attributes, options);
    const settings = ServerConnection.makeSettings();
    const requestUrl = URLExt.join(
      settings.baseUrl,
      'jupyterlab_dosbox', // API Namespace
      'bundles',
      'a1.jsdos'
    );
    this.dos = Dos(this.dosDiv, { emulatorFunction: 'dosWorker' });
    this.ci = await this.dos.run(requestUrl);
    this.ci.screenshot();
  }

  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    lastScreenshot: { serialize: serializeArray, deserialize: deserializeArray }
  }

  dos: DosInstance;
  ci: CommandInterface;
  lastScreenshot: Uint8Array;

  static model_name = 'DosboxRuntimeModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;

}