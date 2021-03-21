// These type definitions are taken from the emulators package, where they are
// not exported.

/* eslint-disable @typescript-eslint/naming-convention */
import { Button } from 'emulators-ui/dist/types/controls/button';
import { EventMapping } from 'emulators-ui/dist/types/controls/nipple';
import { Mapper } from 'emulators-ui/dist/types/controls/keyboard';

export interface LayerConfig {
  name: string;
  buttons: Button[];
  gestures: EventMapping[];
  mapper: Mapper;
}

export interface IMemoryDump {
  memBase: number;
  ip: number;
  flags: number;
  registers: {
    al: number;
    ah: number;
    ax: number;
    eax: number;

    bl: number;
    bh: number;
    bx: number;
    ebx: number;

    cl: number;
    ch: number;
    cx: number;
    ecx: number;

    dl: number;
    dh: number;
    dx: number;
    edx: number;

    si: number;
    esi: number;

    di: number;
    edi: number;

    sp: number;
    esp: number;

    bp: number;
    ebp: number;

    ip: number;
    eip: number;
  };
  segments_values: {
    es: number;
    cs: number;
    ss: number;
    ds: number;
    fs: number;
    gs: number;
  };
  segments_physical: {
    es: number;
    cs: number;
    ss: number;
    ds: number;
    fs: number;
    gs: number;
  };
  numPages: number;
  memoryCopy?: Uint8Array;
}

export type LayersConfig = { [index: string]: LayerConfig };

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function extractLayersConfig(config: any): LayersConfig {
  if (config.layers !== undefined) {
    return config.layers;
  }

  const gestures = config.gestures;
  const buttons = config.buttons;
  const mapper = config.mapper;

  return {
    default: {
      name: 'fallback',
      gestures: gestures || [],
      buttons: buttons || [],
      mapper: mapper || {}
    }
  };
}
