export interface Dimensions {
  width: number;
  height: number;
}

export interface Position {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface BacklightOptions {
  horizontalDivisions: number;
  verticalDivisions: number;
}

export interface Division {
  row: number;
  col: number;
  width: number;
  height: number;
  color: Uint8ClampedArray;
}

// rgba order
export type PixelData = [number, number, number, number];
