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

export interface GPUBatchSize {
  x: number;
  y: number;
  z: number;
}