// These type definitions are taken from the emulators package, where they are
// not exported.

export interface IMemoryDump {
  memBase: number;
  ip: number;
  flags: number;
  registers: {
    ax: number;
    cx: number;
    dx: number;
    sp: number;
    bp: number;
    si: number;
    di: number;
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
