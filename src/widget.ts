import { UUID } from '@lumino/coreutils';
import {
  ManagerBase,
  DOMWidgetModel,
  ISerializers,
  DOMWidgetView
} from '@jupyter-widgets/base';

import { IDocumentManager } from '@jupyterlab/docmanager';
import { IFileBrowserFactory } from '@jupyterlab/filebrowser';

import { MODULE_NAME, MODULE_VERSION } from './version';
import { IMemoryDump } from './jsdosinterfaces';

import type {
  LayerConfig,
  LayersConfig,
  LegacyLayersConfig,
  LegacyLayerConfig
} from 'emulators-ui/dist/types/controls/layers-config';

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
const workerType = 'dosboxDirect';

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
      paused: false,
      _shouldPopout: false,
      coredumps: [],
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
    this.on('change:paused', this.pauseChanged.bind(this));
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
      (this.ci as any).transport.module.FS,
      (this.ci as any).transport.module._rescanFilesystem
    );
    appInfo.manager.services.contents.addDrive(drive);
    const browser = appInfo.factory.createFileBrowser('EMFS-' + this.id, {
      driveName: drive.name
    });
    browser.title.caption = 'DosBox FS';
    browser.title.icon = dosIcon;
    appInfo.app.shell.add(browser, 'left', { rank: 101 });
  }

  private async processQueue() {
    if (this._currentlyProcessing) {
      return;
    }
    this._currentlyProcessing = true;
    const startTime = Date.now();
    let count = 0;
    console.log('processing', this._commandQueue);
    while (this._commandQueue.length > 0) {
      const element = this._commandQueue.shift();
      const keyCode = this.emulatorsUi.controls.namedKeyCodes[element[0]];
      console.log('processing', keyCode);
      (this.ci as any).addKey(
        keyCode,
        element[1],
        startTime + Math.floor(count / 10)
      );
      count += 1;
    }
    this._currentlyProcessing = false;
  }

  pauseChanged(): void {
    this.paused = this.get('paused');
    const dosModule = (this.ci as any).transport.module;
    dosModule._pauseExecution(this.paused);
    if (!this.paused) {
      console.log('Processing queued keys.');
      this.processQueue();
    }
  }

  // Inspired by the ipycanvas commands
  async onCommand(command: any, buffers: any): Promise<void> {
    // Process keyboard commands first
    const manager: ManagerBase<any> = this.widget_manager;
    let newCoreDump: DosboxCoreDumpModel;
    let newScreenshot: DosboxScreenshotModel;
    let screenshot: ImageData;
    let dosModule: any;
    let memoryCopy: Uint8Array;
    let bytes: Uint8Array;
    let bytesView: DataView;
    let keyCodes: Array<[string, boolean]>;
    switch (command.name) {
      case 'sendKeys':
        keyCodes = command.args;
        // is this safe?
        this._commandQueue = this._commandQueue.concat(keyCodes);
        if (this.get('paused')) {
          console.log('Queuing keys for deferred execution');
          return;
        } else {
          return this.processQueue();
        }
        break;
      case 'screenshot':
        screenshot = await this.ci.screenshot();
        newScreenshot = (await manager.new_widget({
          model_name: DosboxScreenshotModel.model_name,
          model_module: DosboxScreenshotModel.model_module,
          model_module_version: DosboxScreenshotModel.model_module_version,
          view_name: DosboxScreenshotModel.view_name,
          view_module: DosboxScreenshotModel.view_module,
          view_module_version: DosboxScreenshotModel.view_module_version
        })) as DosboxScreenshotModel;
        newScreenshot.set('screenshot', screenshot.data.slice(0));
        newScreenshot.set('width', screenshot.width);
        newScreenshot.set('height', screenshot.height);
        newScreenshot.save();
        this.screenshots = this.get('screenshots').concat([newScreenshot]);
        this.set('screenshots', this.screenshots);
        this.save_changes();
        break;
      case 'coreDump':
        dosModule = (this.ci as any).transport.module;
        await dosModule._dumpMemory(command.args[0] ? true : false);
        memoryCopy = command.args[0]
          ? dosModule.memoryContents['memoryCopy']
          : EmptyUint8Array;
        newCoreDump = (await manager.new_widget({
          model_name: DosboxCoreDumpModel.model_name,
          model_module: DosboxCoreDumpModel.model_module,
          model_module_version: DosboxCoreDumpModel.model_module_version,
          view_name: DosboxCoreDumpModel.view_name,
          view_module: DosboxCoreDumpModel.view_module,
          view_module_version: DosboxCoreDumpModel.view_module_version
        })) as DosboxCoreDumpModel;
        [
          'memBase',
          'ip',
          'flags',
          'registers',
          'segments_physical',
          'segments_values'
        ].forEach(v => newCoreDump.set(v, dosModule.memoryContents[v]));
        newCoreDump.set('memoryCopy', memoryCopy);
        newCoreDump.save();
        this.coredumps = this.get('coredumps').concat([newCoreDump]);
        this.set('coredumps', this.coredumps);
        this.save_changes();
        break;
      case 'sendZipfile':
        console.log('ci');
        console.log(this.ci);
        dosModule = (this.ci as any).transport.module;
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
      case 'popOut':
        this.set('_shouldPopout', true);
        this.save();
        break;
      default:
        break;
    }
  }

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
          emulatorsUi.network.resolveBundle(changesUrl, { httpCache: false })
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
  screenshots: DosboxScreenshotModel[];
  coredumps: DosboxCoreDumpModel[];
  _shouldPopout = false;
  emulatorsUi: EmulatorsUi;
  ciPromise?: Promise<CommandInterface>;
  running: boolean;
  activelayer = 'default';
  _currentlyProcessing = false;
  _commandQueue: Array<[string, boolean]> = [];
  paused: false;

  static model_name = 'DosboxRuntimeModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
  static view_name = 'DosboxRuntimeView';
  static view_module = MODULE_NAME;
  static view_module_version = MODULE_VERSION;
}

export class DosboxCoreDumpModel extends DOMWidgetModel implements IMemoryDump {
  defaults(): any {
    return {
      ...super.defaults(),
      memBase: 0,
      ip: 0,
      flags: 0,
      registers: {},
      segments_values: {},
      segments_physical: {},
      numPages: 0,
      memoryCopy: EmptyUint8Array,
      _model_name: DosboxCoreDumpModel.model_name,
      _model_module: DosboxCoreDumpModel.model_module,
      _model_module_version: DosboxCoreDumpModel.model_module_version,
      _view_name: DosboxCoreDumpModel.view_name,
      _view_module: DosboxCoreDumpModel.view_module,
      _view_module_version: DosboxCoreDumpModel.view_module_version
    };
  }

  async initialize(attributes: any, options: any): Promise<void> {
    super.initialize(attributes, options);
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    memoryCopy: {
      serialize: serializeArray,
      deserialize: deserializeArrayUint8
    }
  };

  memBase: number;
  ip: number;
  flags: number;
  registers: any;
  segments_values: any;
  segments_physical: any;
  numPages: number;
  memoryCopy?: Uint8Array;
  static model_name = 'DosboxCoreDumpModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
  static view_name = 'DosboxCoreDumpView';
  static view_module = MODULE_NAME;
  static view_module_version = MODULE_VERSION;
}

export class DosboxCoreDumpView extends DOMWidgetView {
  async render(): Promise<void> {
    super.render();
    return this.setupEventListeners();
  }
  async setupEventListeners(): Promise<void> {
    return;
  }
  model: DosboxCoreDumpModel;
}

export class DosboxScreenshotModel extends DOMWidgetModel {
  defaults(): any {
    return {
      ...super.defaults(),
      width: 0,
      height: 0,
      screenshot: EmptyUint8Array,
      _model_name: DosboxScreenshotModel.model_name,
      _model_module: DosboxScreenshotModel.model_module,
      _model_module_version: DosboxScreenshotModel.model_module_version,
      _view_name: DosboxScreenshotModel.view_name,
      _view_module: DosboxScreenshotModel.view_module,
      _view_module_version: DosboxScreenshotModel.view_module_version
    };
  }

  async initialize(attributes: any, options: any): Promise<void> {
    super.initialize(attributes, options);
  }

  static serializers: ISerializers = {
    ...DOMWidgetModel.serializers,
    screenshot: {
      serialize: serializeArray,
      deserialize: deserializeArrayUint8Clamped
    }
  };

  screenshot?: Uint8ClampedArray;
  width: number;
  height: number;
  static model_name = 'DosboxScreenshotModel';
  static model_module = MODULE_NAME;
  static model_module_version = MODULE_VERSION;
  static view_name = 'DosboxScreenshotView';
  static view_module = MODULE_NAME;
  static view_module_version = MODULE_VERSION;
}

export class DosboxScreenshotView extends DOMWidgetView {
  async render(): Promise<void> {
    super.render();
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    const img = new ImageData(
      this.model.get('screenshot'),
      this.model.get('width'),
      this.model.get('height')
    );
    this.canvas.setAttribute('width', this.model.get('width'));
    this.canvas.setAttribute('height', this.model.get('height'));
    this.el.appendChild(this.canvas);
    ctx.putImageData(img, 0, 0);
    console.log(ctx, img, this.model.get('width'), this.model.get('height'));
    return this.setupEventListeners();
  }
  async setupEventListeners(): Promise<void> {
    return;
  }
  canvas: HTMLCanvasElement;
  model: DosboxCoreDumpModel;
}

export class DosboxRuntimeView extends DOMWidgetView {
  render(): void {
    this.div = document.createElement('div');
    this.divId = 'dos-' + UUID.uuid4();
    this.div.setAttribute('id', this.divId);
    this.el.classList.add('jp-jsDosWidget');
    this.el.appendChild(this.div);
    this.setupEventListeners();
    if (this.model.get('running')) {
      this.displayed.then(v => {
        this.connectLayers();
        return v;
      });
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
    this.layersConfig = {}; //extractLayersConfig(config);
    this.layerNames = Object.keys(this.layersConfig);
    emulatorsUi.controls.options(
      this.layers,
      this.layerNames,
      this.changeLayer,
      0,
      0,
      0
    );
    // Make all the different layers invisible or hidden
    (this.layers as any).clickToStart.style.display = 'none';
    this.layers.hideLoadingLayer();
    this.layers.canvas.setAttribute('tabindex', '1');
    this.layers.video.style.display = 'none';
    this.layers.loading.style.display = 'none';
    this.changeLayer();
    this.resetEventListeners();
    this.pausedDiv = document.createElement('div');
    this.pausedDiv.classList.add('jupyter-widgets');
    this.pausedDiv.classList.add('jupyter-button');
    this.pausedDiv.classList.add('widget-checkbox');
    this.pausedBox = document.createElement('input');
    this.pausedBox.disabled =
      (this.ci as any).transport.module._pauseExecution === undefined;
    this.pausedBox.setAttribute('type', 'checkbox');
    this.pausedBox.setAttribute('name', 'paused');
    this.pausedBox.checked = this.model.get('paused');
    this.pausedDiv.appendChild(this.pausedBox);
    const pauseLabel = document.createElement('label');
    pauseLabel.classList.add('widget-label-basic');
    pauseLabel.setAttribute('for', 'paused');
    pauseLabel.innerHTML = 'Paused';
    this.pausedDiv.appendChild(pauseLabel);
    this.el.appendChild(this.pausedDiv);
    this.pausedBox.addEventListener('change', e => {
      this.model.set('paused', this.pausedBox.checked);
      this.model.save();
    });
    this.coredumpDiv = document.createElement('div');
    this.coredumpDiv.classList.add('jupyter-widgets');
    this.coredumpDiv.classList.add('jupyter-button');
    this.coredumpDiv.classList.add('widget-button');
    this.coredumpButton = document.createElement('button');
    this.coredumpButton.innerHTML = 'Coredump';
    this.coredumpDiv.appendChild(this.coredumpButton);
    this.el.append(this.coredumpDiv);
    this.coredumpButton.addEventListener('click', e => {
      this.model.onCommand({ name: 'coreDump', args: [true] }, []);
      this.model.save();
    });
    this.screenshotDiv = document.createElement('div');
    this.screenshotDiv.classList.add('jupyter-widgets');
    this.screenshotDiv.classList.add('jupyter-button');
    this.screenshotDiv.classList.add('widget-button');
    this.screenshotButton = document.createElement('button');
    this.screenshotButton.innerHTML = 'Screenshot';
    this.screenshotDiv.appendChild(this.screenshotButton);
    this.el.appendChild(this.screenshotDiv);
    this.screenshotButton.addEventListener('click', e => {
      this.model.onCommand({ name: 'screenshot', args: [true] }, []);
      this.model.save();
    });
  }

  private resetEventListeners(): void {
    // At present, we don't call this. I'm not entirely sure why, but right now
    // it is not working to correctly snag the data we want. I'll follow up with
    // it in the future.

    const eventLayers = this.layers as unknown as ILayerEvents;
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
    const layer = _getLayer(this.layersConfig, this.layerNames, layerName);
    if (layer === undefined) {
      return;
    }
    emulatorsUi.controls.keyboard(this.layers, this.ci);
    emulatorsUi.controls.mouse(false, 0, this.layers, this.ci);
  }

  layerNames: string[] = null;
  layersConfig: LayersConfig | LegacyLayersConfig = null;
  model: DosboxRuntimeModelAbs;
  div: HTMLDivElement;
  divId: string;
  layers: Layers;
  ci: CommandInterface;
  layerKeyHandlers: [(keyCode: number) => void, (keyCode: number) => void];
  addCanvasListeners = false;
  pausedBox: HTMLInputElement;
  pausedDiv: HTMLDivElement;
  coredumpButton: HTMLButtonElement;
  coredumpDiv: HTMLDivElement;
  screenshotButton: HTMLButtonElement;
  screenshotDiv: HTMLDivElement;
}

function _getLayer(
  layers: LayersConfig | LegacyLayersConfig,
  layerNames: string[],
  layerName: string
): LayerConfig | LegacyLayerConfig {
  if ('layers' in layers) {
    const layerIndex = layerNames.indexOf(layerName);
    return (layers as LayersConfig).layers[layerIndex];
  } else {
    return (layers as LegacyLayersConfig)[layerName];
  }
}
