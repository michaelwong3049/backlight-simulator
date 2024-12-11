interface BacklightOptions {
  horizontalDivisions: number;
  verticalDivisions: number;
}

export function computeBacklightFrame(
  frame: ImageData,
  opts?: BacklightOptions
) {
  return frame;
}
