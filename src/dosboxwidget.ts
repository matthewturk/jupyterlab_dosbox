import { Widget } from '@lumino/widgets';
import {
  DOMWidgetModel,
  ISerializers,
  WidgetModel,
  unpack_models
} from '@jupyter-widgets/base';
import { MODULE_NAME, MODULE_VERSION } from './version';

import { CommandInterface, Emulators } from 'emulators';
import { DosFactoryType, DosInstance } from 'emulators-ui/dist/types/js-dos';

import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { EmulatorsUi } from 'emulators-ui';
//import { EmulatorsUi } from 'emulators-ui';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulators = await import('emulators');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulatorsUi = await import('emulators-ui');

// Having this be 'janus' causes some issues we can't work around
const workerType = 'dosWorker';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
//const _wworker = await import('emulators/dist/wworker');

declare const Dos: DosFactoryType;
declare const emulators: Emulators;
declare const emulatorsUi: EmulatorsUi;

function serializeArray(array: Float64Array): DataView {
  return new DataView(array.buffer.slice(0));
}

function deserializeArray(dataview: DataView | null): Float64Array | null {
  if (dataview === null) {
    return null;
  }

  return new Float64Array(dataview.buffer);
}

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

export class DosboxRuntimeModel extends DOMWidgetModel {
  defaults(): any {
    return {
      ...super.defaults(),
      _model_name: DosboxRuntimeModel.model_name,
      _model_module: DosboxRuntimeModel.model_module,
      _model_module_version: DosboxRuntimeModel.model_module_version
    };
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async initialize(attributes: any, options: any): Promise<void> {
    super.initialize(attributes, options);
    this.emulatorsUi = emulatorsUi;
    const settings = ServerConnection.makeSettings();
    const requestUrl = URLExt.join(
      settings.baseUrl,
      'jupyterlab_dosbox', // API Namespace
      'bundles',
      'a1.jsdos'
    );
    this.ci = await this.run(requestUrl);
    this.ci.screenshot();
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    lastScreenshot: { serialize: serializeArray, deserialize: deserializeArray }
  };

  async run(
    bundleUrl: string,
    optionalChangesUrl?: string
  ): Promise<CommandInterface> {
    await this.stop();
    const changesUrl = optionalChangesUrl || bundleUrl + '.changed';
    const emulatorsUi = this.emulatorsUi;
    //this.layers.setLoadingMessage('Downloading bundle ...');
    const bundlePromise = emulatorsUi.network.resolveBundle(bundleUrl, {
      onprogress: (percent: number) =>
        // This should be replaced with a jupyter specific loading message, or something
        //this.layers.setLoadingMessage('Downloading bundle ' + percent + '%')
        console.log('Downloading bundle ' + percent + '%')
    });
    try {
      const changesBundle = await emulatorsUi.persist
        .load(changesUrl, emulators)
        .catch(() =>
          emulatorsUi.network.resolveBundle(changesUrl, { cache: null })
        );
      const bundle = await bundlePromise;
      this.ciPromise = emulators[workerType]([bundle, changesBundle]);
    } catch {
      const bundle = await bundlePromise;
      this.ciPromise = emulators[workerType]([bundle]);
    }

    let ci: CommandInterface;
    try {
      //this.layers.setLoadingMessage('Starting...');
      ci = await this.ciPromise;
    } catch (e) {
      console.log('Unexpected error occurred');
      //this.layers.setLoadingMessage('Unexpected error occured...');
      //this.layers.notyf.error({
      //message: "Can't start emulator look browser logs for more info"
      //});
      console.error(e);
      throw e;
    }

    return ci;
  }

  async stop(): Promise<void> {
    //this.layers.showLoadingLayer();

    if (this.ciPromise === undefined) {
      return;
    }

    const ci = await this.ciPromise;
    delete this.ciPromise;
    await ci.exit();

    return;
  }

  dos: DosInstance;
  ci: CommandInterface;
  lastScreenshot: Uint8Array;
  emulatorsUi: EmulatorsUi;
  ciPromise?: Promise<CommandInterface>;

  static model_name = 'DosboxRuntimeModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
}
