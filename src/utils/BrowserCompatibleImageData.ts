import { ImageData } from 'canvas';

export class BrowserCompatibleImageData extends ImageData {
  readonly colorSpace: PredefinedColorSpace;
  
  constructor(arg1: number | Uint8ClampedArray, arg2: number, arg3?: number | ImageDataSettings, arg4?: ImageDataSettings) {
    // constructor(width: number, height: number, settings?: ImageDataSettings)
    if (typeof arg1 === 'number') {
      super(arg1, arg2);

      if (arg3 == undefined) {
        this.colorSpace = 'srgb';
        return;
      }

      if (typeof arg3 !== 'object' || !('colorSpace' in arg3)) {
        throw new Error(`Expected arg3 to be ImageDataSettings! Instead got ${typeof arg3}`);
      }

      this.colorSpace = arg3.colorSpace ?? 'srgb';
    } else {
      if (typeof arg3 !== 'number') {
        throw new Error(`Expected arg3 to be number! Instead got ${typeof arg3}`);
      }
      super(arg1, arg2, arg3)

      if (arg4 == undefined) {
        this.colorSpace = 'srgb';
        return;
      }

      if (typeof arg4 !== 'object' || !('colorSpace' in arg4)) {
        throw new Error(`Expected arg4 to be ImageDataSettings! Instead got ${typeof arg4}`);
      }
      this.colorSpace = arg4.colorSpace ?? 'srgb';
    }
  }
}

const t = new ImageData(100, 100);