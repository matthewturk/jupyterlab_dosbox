import { CommandInterface, Emulators } from 'emulators';
import { DosOptions, EmulatorFunction } from 'emulators-ui/dist/types/js-dos';
import { EmulatorsUi } from 'emulators-ui';
import { Layers } from 'emulators-ui/dist/types/dom/layers';

declare const emulators: Emulators;

export class UnboundDosInstance {
  emulatorsUi: EmulatorsUi;
  emulatorFunction: EmulatorFunction;
  layers: Layers;
  ciPromise?: Promise<CommandInterface>;

  enableMobileControls: () => void = () => {
    /**/
  };
  disableMobileControls: () => void = () => {
    /**/
  };

  private clickToStart: boolean;

  constructor(
    root: HTMLDivElement,
    emulatorsUi: EmulatorsUi,
    options: DosOptions
  ) {
    this.emulatorsUi = emulatorsUi;
    this.emulatorFunction = options.emulatorFunction || 'dosWorker';
    this.clickToStart = options.clickToStart || false;
    // I think this is the part we *don't* want to do right now.
    //this.layers = this.emulatorsUi.dom.layers(root, options.layersOptions);
    //this.layers.showLoadingLayer();
  }

  async run(
    bundleUrl: string,
    optionalChangesUrl?: string
  ): Promise<CommandInterface> {
    await this.stop();
    const changesUrl = optionalChangesUrl || bundleUrl + '.changed';
    const emulatorsUi = this.emulatorsUi;
    if (this.emulatorFunction === 'janus') {
      this.layers.setLoadingMessage('Connecting...');
      this.ciPromise = emulators[this.emulatorFunction](bundleUrl);
    } else {
      //this.layers.setLoadingMessage('Downloading bundle ...');
      const bundlePromise = emulatorsUi.network.resolveBundle(bundleUrl, {
        onprogress: (percent: number) =>
        // This should be replaced with a jupyter specific loading message, or something
          //this.layers.setLoadingMessage('Downloading bundle ' + percent + '%')
      });
      try {
        const changesBundle = await emulatorsUi.persist
          .load(changesUrl, emulators)
          .catch(() =>
            emulatorsUi.network.resolveBundle(changesUrl, { cache: null })
          );
        const bundle = await bundlePromise;
        this.ciPromise = emulators[this.emulatorFunction]([
          bundle,
          changesBundle
        ]);
      } catch {
        const bundle = await bundlePromise;
        this.ciPromise = emulators[this.emulatorFunction]([bundle]);
      }
    }

    let ci: CommandInterface;
    try {
      //this.layers.setLoadingMessage('Starting...');
      ci = await this.ciPromise;
    } catch (e) {
      //this.layers.setLoadingMessage('Unexpected error occured...');
      //this.layers.notyf.error({
        //message: "Can't start emulator look browser logs for more info"
      //});
      console.error(e);
      throw e;
    }

    if (this.emulatorFunction === 'janus') {
      emulatorsUi.graphics.video(this.layers, ci);
    } else {
      emulatorsUi.persist.save(changesUrl, this.layers, ci, emulators);
      emulatorsUi.graphics.webGl(this.layers, ci);
      emulatorsUi.sound.audioNode(ci);
    }

    this.layers.setLoadingMessage('Waiting for config...');
    const config = await ci.config();
    const layersConfig = extractLayersConfig(config);
    const layersNames = Object.keys(layersConfig);

    const unbind = {
      keyboard: () => {
        /**/
      },
      mouse: () => {
        /**/
      },
      gestures: () => {
        /**/
      },
      buttons: () => {
        /**/
      }
    };

    let currentLayer = '';
    const changeControlLayer = (layerName: string) => {
      unbind.keyboard();
      unbind.mouse();
      unbind.gestures();
      unbind.buttons();

      unbind.keyboard = () => {
        /**/
      };
      unbind.mouse = () => {
        /**/
      };
      unbind.gestures = () => {
        /**/
      };
      unbind.buttons = () => {
        /**/
      };

      currentLayer = layerName;
      const layer = layersConfig[layerName];
      if (layer === undefined) {
        return;
      }

      unbind.keyboard = emulatorsUi.controls.keyboard(
        this.layers,
        ci,
        layer.mapper
      );

      if (layer.gestures !== undefined && layer.gestures.length > 0) {
        unbind.gestures = emulatorsUi.controls.nipple(
          this.layers,
          ci,
          layer.gestures
        );
      } else {
        unbind.mouse = emulatorsUi.controls.mouse(this.layers, ci);
      }

      if (layer.buttons !== undefined && layer.buttons.length) {
        unbind.buttons = emulatorsUi.controls.button(
          this.layers,
          ci,
          layer.buttons
        );
      }
    };

    this.disableMobileControls = () => {
      unbind.gestures();
      unbind.buttons();
      unbind.gestures = () => {
        /**/
      };
      unbind.buttons = () => {
        /**/
      };
    };

    this.enableMobileControls = () => {
      changeControlLayer(currentLayer);
    };

    emulatorsUi.controls.options(
      this.layers,
      ci,
      layersNames,
      changeControlLayer
    );
    changeControlLayer('default');

    this.layers.setLoadingMessage('Ready');
    this.layers.hideLoadingLayer();

    if (this.clickToStart) {
      this.layers.showClickToStart();
    }

    return ci;
  }

  async stop(): Promise<void> {
    this.layers.showLoadingLayer();

    if (this.ciPromise === undefined) {
      return;
    }

    const ci = await this.ciPromise;
    delete this.ciPromise;
    await ci.exit();

    return;
  }
}
