import { UUID } from '@lumino/coreutils';
import {
  DOMWidgetModel,
  ISerializers,
  DOMWidgetView
} from '@jupyter-widgets/base';

import { IDocumentManager } from '@jupyterlab/docmanager';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { MODULE_NAME, MODULE_VERSION } from './version';
import { extractLayersConfig, LayersConfig } from './jsdosinterfaces';

import { CommandInterface, Emulators } from 'emulators';
import { DosInstance } from 'emulators-ui/dist/types/js-dos';

import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';
import { EmulatorsUi } from 'emulators-ui';
import { Layers } from 'emulators-ui/dist/types/dom/layers';
import { JupyterFrontEnd } from '@jupyterlab/application';
import { EmscriptenDrive } from './contents';
import { dosIcon } from './icon';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulators = await import('emulators');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emulatorsUi = await import('emulators-ui');
// eslint-disable-next-line @typescript-eslint/no-unused-vars

// Having this be 'janus' causes some issues we can't work around
// And for the purposes of debugging, we want this to be dosDirect.
const workerType = 'dosDirect';

declare const emulators: Emulators;
declare const emulatorsUi: EmulatorsUi;

interface ILayerEvents {
  onKeyDown(keyCode: number): void;
  onKeyUp(keyCode: number): void;
}

export interface IAppInfo {
  app: JupyterFrontEnd;
  manager: IDocumentManager;
  factory: IFileBrowserFactory;
}

function serializeArray(
  array: Uint8ClampedArray | Uint8Array | null
): DataView | null {
  return new DataView(array.buffer.slice(0));
}

function deserializeArrayUint8Clamped(
  dataview: DataView | null
): Uint8ClampedArray | null {
  if (dataview === null) {
    return null;
  }

  return new Uint8ClampedArray(dataview.buffer);
}

const EmptyUint8Array = new Uint8Array();

// If I could figure out generics with constructors, I wouldn't
// need to do this!
function deserializeArrayUint8(dataview: DataView | null): Uint8Array | null {
  if (dataview === null) {
    return null;
  }
  return new Uint8Array(dataview.buffer);
}

export abstract class DosboxRuntimeModelAbs extends DOMWidgetModel {
  defaults(): any {
    return {
      ...super.defaults(),
      running: false,
      activelayer: 'default',
      _shouldPopout: false,
      _last_registerdump: undefined,
      _last_coredump: undefined,
      _last_screenshot: undefined,
      _model_name: DosboxRuntimeModelAbs.model_name,
      _model_module: DosboxRuntimeModelAbs.model_module,
      _model_module_version: DosboxRuntimeModelAbs.model_module_version,
      _view_name: DosboxRuntimeModelAbs.view_name,
      _view_module: DosboxRuntimeModelAbs.view_module,
      _view_module_version: DosboxRuntimeModelAbs.view_module_version
    };
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async initialize(attributes: any, options: any): Promise<void> {
    emulators.pathPrefix = '/jupyterlab_dosbox/wasm/';
    this.on('msg:custom', this.onCommand.bind(this));
    super.initialize(attributes, options);
    this.emulatorsUi = emulatorsUi;
    const settings = ServerConnection.makeSettings();
    const requestUrl = URLExt.join(
      settings.baseUrl,
      'jupyterlab_dosbox', // API Namespace
      'bundles',
      'null_bundle.jsdos'
    );
    this.ci = await this.run(requestUrl);
    this.set('running', true);
    if (this.get('_shouldPopout')) {
      await this.popOut();
    } else {
      this.once('change:_shouldPopout', this.popOut);
    }
  }

  async popOut(): Promise<void> {
    // Automatically add a new view to the shell
    const appInfo = this.getAppInfo();
    const view = await this.widget_manager.create_view(this, {});
    view.pWidget.id = this.id + '-shell-widget';
    view.pWidget.addClass('dosbox-widget');
    view.pWidget.title.label = 'DosBox Instance';
    view.pWidget.title.closable = true;
    appInfo.app.shell.add(view.pWidget, 'main', { activate: false });

    // Let's also add a file browser
    const drive = new EmscriptenDrive(
      (this.ci as any).module.FS,
      (this.ci as any).module._rescanFilesystem
    );
    appInfo.manager.services.contents.addDrive(drive);
    const browser = appInfo.factory.createFileBrowser('EMFS-' + this.id, {
      driveName: drive.name
    });
    browser.title.caption = 'DosBox FS';
    browser.title.icon = dosIcon;
    appInfo.app.shell.add(browser, 'left', { rank: 101 });
  }

  // Inspired by the ipycanvas commands
  private async onCommand(command: any, buffers: any) {
    // Process keyboard commands first
    let screenshot: ImageData;
    let registers: { [name: string]: any };
    let dosModule: any;
    let memoryCopy: Uint8Array;
    let bytes: Uint8Array;
    let bytesView: DataView;
    let keyCodes: Array<[string, boolean]>;
    let count = 0;
    switch (command.name) {
      case 'sendKeys':
        keyCodes = command.args;
        for (const element of keyCodes) {
          count += 1;
          const keyCode = this.emulatorsUi.controls.namedKeyCodes[element[0]];
          //this.ci.simulateKeyPress(keyCode);
          (this.ci as any).addKey(keyCode, element[1], count);
        }
        break;
      case 'screenshot':
        screenshot = await this.ci.screenshot();
        this.set('_last_screenshot', screenshot.data.slice(0));
        this.save();
        break;
      case 'coreDump':
        dosModule = (this.ci as any).module;
        await dosModule._dumpMemory(command.args[0] ? true : false);
        registers = {};
        memoryCopy = command.args[0]
          ? dosModule.memoryContents['memoryCopy']
          : EmptyUint8Array;
        this.set('_last_coredump', memoryCopy);
        [
          'memBase',
          'ip',
          'flags',
          'registers',
          'segments_physical',
          'segments_values'
        ].forEach(v => (registers[v] = dosModule.memoryContents[v]));
        this.set('_last_registerdump', registers);
        this.save();
        break;
      case 'sendZipfile':
        dosModule = (this.ci as any).module;
        dosModule.FS.chdir('/home/web_user');
        for (bytesView of buffers) {
          bytes = new Uint8Array(bytesView.buffer);
          const buffer = dosModule._malloc(bytes.length);
          dosModule.HEAPU8.set(bytes, buffer);
          dosModule._zip_to_fs(buffer, bytes.length);
          dosModule._free(buffer);
        }
        dosModule._rescanFilesystem();
        break;
      case 'debug':
        (window as any).dosboxWidget = this;
        break;
      case 'pause':
        dosModule = (this.ci as any).module;
        dosModule._toggleDebugger();
        break;
      case 'popOut':
        this.set('_shouldPopout', true);
        this.save();
        break;
      default:
        break;
    }
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    _last_screenshot: {
      serialize: serializeArray,
      deserialize: deserializeArrayUint8Clamped
    },
    _last_coredump: {
      serialize: serializeArray,
      deserialize: deserializeArrayUint8
    }
  };

  async run(
    bundleUrl: string,
    optionalChangesUrl?: string
  ): Promise<CommandInterface> {
    await this.stop();
    const changesUrl = optionalChangesUrl || bundleUrl + '.changed';
    const emulatorsUi = this.emulatorsUi;
    //this.layers.setLoadingMessage('Downloading bundle ...');
    console.log('Starting download');
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
    this.set('running', false);

    return;
  }

  public abstract getAppInfo(): IAppInfo;

  dos: DosInstance;
  ci: CommandInterface;
  _last_screenshot: Uint8ClampedArray;
  _last_registerdump: any;
  _last_coredump: Uint8Array;
  _shouldPopout = false;
  emulatorsUi: EmulatorsUi;
  ciPromise?: Promise<CommandInterface>;
  running: boolean;
  activelayer = 'default';

  static model_name = 'DosboxRuntimeModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
  static view_name = 'DosboxRuntimeView';
  static view_module = MODULE_NAME;
  static view_module_version = MODULE_VERSION;
}

export class DosboxRuntimeView extends DOMWidgetView {
  render(): void {
    this.div = document.createElement('div');
    this.divId = 'dos-' + UUID.uuid4();
    this.div.setAttribute('id', this.divId);
    this.el.classList.add('jsdos');
    this.el.appendChild(this.div);
    this.setupEventListeners();
    if (this.model.get('running')) {
      this.connectLayers();
    }
  }

  setupEventListeners(): void {
    this.model.on('change:running', this.connectLayers, this);
    this.model.on('change:activelayer', this.changeLayer, this);
  }

  async connectLayers(): Promise<void> {
    this.ci = await this.model.ciPromise;
    this.layers = this.model.emulatorsUi.dom.layers(this.div);

    // This is where we will connect our layers. It's possible this will cause
    // issues with multiple views.
    emulatorsUi.persist.save('', this.layers, this.ci, emulators);
    this.model.emulatorsUi.graphics.webGl(this.layers, this.ci);
    this.model.emulatorsUi.sound.audioNode(this.ci);
    const config = await this.ci.config();
    this.layerConfig = extractLayersConfig(config);
    this.layerNames = Object.keys(this.layerConfig);
    emulatorsUi.controls.options(
      this.layers,
      this.ci,
      this.layerNames,
      this.changeLayer
    );
    // Make all the different layers invisible or hidden
    (this.layers as any).clickToStart.style.display = 'none';
    this.layers.hideLoadingLayer();
    this.layers.canvas.setAttribute('tabindex', '1');
    this.layers.video.style.display = 'none';
    this.layers.loading.style.display = 'none';
    this.changeLayer();
    this.resetEventListeners();
  }

  private resetEventListeners(): void {
    // At present, we don't call this. I'm not entirely sure why, but right now
    // it is not working to correctly snag the data we want. I'll follow up with
    // it in the future.

    const eventLayers = (this.layers as unknown) as ILayerEvents;
    const domToKeyCode = emulatorsUi.controls.domToKeyCode;
    // We can't remove the listeners directly because they are anonymous and gone.
    // We'll do the next best thing and ask the layers to ignore them.
    this.layerKeyHandlers = [eventLayers.onKeyDown, eventLayers.onKeyUp];
    this.layers.setOnKeyDown(() => null);
    this.layers.setOnKeyUp(() => null);
    // The sadness of making these anonymous and unretrievable functions has not
    // escaped me, by the way.
    if (this.addCanvasListeners === true) {
      this.layers.canvas.addEventListener('keydown', e => {
        e.preventDefault();
        e.stopPropagation();
        this.layerKeyHandlers[0](domToKeyCode((e as any).keyCode));
      });
      this.layers.canvas.addEventListener('keyup', e => {
        e.preventDefault();
        e.stopPropagation();
        this.layerKeyHandlers[1](domToKeyCode((e as any).keyCode));
      });
    }
  }

  changeLayer(): void {
    if (this.layerNames === undefined) {
      return;
    }
    const layerName: string = this.model.get('activelayer');
    const layer = this.layerConfig[layerName];
    if (layer === undefined) {
      return;
    }
    emulatorsUi.controls.keyboard(this.layers, this.ci, layer.mapper);
    emulatorsUi.controls.mouse(this.layers, this.ci);
  }

  layerNames: string[] = null;
  layerConfig: LayersConfig = null;
  model: DosboxRuntimeModelAbs;
  div: HTMLDivElement;
  divId: string;
  layers: Layers;
  ci: CommandInterface;
  layerKeyHandlers: [(keyCode: number) => void, (keyCode: number) => void];
  addCanvasListeners = false;
}
