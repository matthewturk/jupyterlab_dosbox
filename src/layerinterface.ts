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
