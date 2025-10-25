import type { Dimensions, BacklightOptions, Division, Position } from '@/types';
import {
  ALPHA_CHANNEL_OFFSET,
  BLUE_CHANNEL_OFFSET,
  GREEN_CHANNEL_OFFSET,
  RED_CHANNEL_OFFSET,
} from '@/constants';

export function computeBacklightFrame(
  // TODO: remove ctx later, we should be able to do some assignments on frame.data
  ctx: CanvasRenderingContext2D,
  frame: ImageData,
  videoDimensions: Dimensions,
  opts: BacklightOptions
) {
  const newFrame = new Uint8ClampedArray(frame.data.length);
  const divisions = computeDivisions(
    frame,
    videoDimensions,
    opts.horizontalDivisions,
    opts.verticalDivisions,
    false
  );
  const convolutionRegion: Dimensions = { width: Math.round(divisions[0].width / 2), height: Math.round(divisions[0].height / 2) };

  // setting the colors for each division first
  for(let div = 0; div < divisions.length; div++) {
    const currDiv = divisions[div];

    for(let row = currDiv.row; row < currDiv.row + currDiv.height; row++) {
      for(let col = currDiv.col; col < currDiv.col + currDiv.width; col++) {
        const frameIndex = (row * frame.width + col) * 4;
      
        newFrame[frameIndex + RED_CHANNEL_OFFSET] = currDiv.color[RED_CHANNEL_OFFSET];
        newFrame[frameIndex + GREEN_CHANNEL_OFFSET] = currDiv.color[GREEN_CHANNEL_OFFSET];
        newFrame[frameIndex + BLUE_CHANNEL_OFFSET] = currDiv.color[BLUE_CHANNEL_OFFSET];
        newFrame[frameIndex + ALPHA_CHANNEL_OFFSET] = currDiv.color[ALPHA_CHANNEL_OFFSET];
      }
    }
  }
 
  // convolve regions
  for(let div = 0; div < divisions.length - 1; div++) {
    let currDiv = divisions[div];
    let nextDiv = divisions[div + 1];

    // convolve down and right as long as we are not on the right side
    if(currDiv.col < nextDiv.col) {
      regionConvolution(
        new ImageData(new Uint8ClampedArray(newFrame), frame.width, frame.height),
        newFrame,
        currDiv.row,
        nextDiv.col - Math.round(convolutionRegion.width / 2),
        nextDiv.row + nextDiv.height,
        nextDiv.col + Math.round(convolutionRegion.width / 2),
        3
      )
    }

    if(currDiv.row + currDiv.height + convolutionRegion.height <= frame.height) {
      regionConvolution(
        new ImageData(new Uint8ClampedArray(newFrame), frame.width, frame.height),
        newFrame,
        currDiv.row + convolutionRegion.height,
        currDiv.col,
        currDiv.row + currDiv.height + convolutionRegion.height,
        currDiv.col + currDiv.width,  
        3
      )
    }
  }

  return new ImageData(newFrame, frame.width, frame.height);
}

// TODO: handle corners better by average the width and height
export function computeDivisions(
  frame: ImageData,
  videoDimensions: Dimensions,
  horizontalDivisions: number,
  verticalDivisions: number,
  debugColoring = false
) {
  // ok to dynamically size here, should remain small (< 64)
  const divisions: Array<Division> = [];

  // TODO: this can be float, need to cast to int
  const canvasDivision: Dimensions = {
    width: Math.floor(frame.width / horizontalDivisions),
    height: Math.floor(frame.height / verticalDivisions),
  };

  // dynamically figure out the padding around the video assuming the video is centered
  const videoPosition = findVideoPositionOnCanvas({ height: frame.height, width: frame.width }, videoDimensions);

  let divisionIdx = 0;
  // loop through all regions with offset, smart skip if we're in video range
  // placed a -10 since without it, there would be extra divisions 
  for (let row = 0; row < frame.height - 5; row += canvasDivision.height) {
    for (let col = 0; col < frame.width - 5; col += canvasDivision.width) {

      // these variables are needed to check whether to draw if the division is "half-in half-out" of the video and canvas
      const endingRow = row + canvasDivision.height;
      const endingCol = col + canvasDivision.width;

      const isFirstFit = row === 0 || col === 0;
      const isLastFit =
        row + canvasDivision.height >= frame.height ||
        col + canvasDivision.width >= frame.width;
      const rowAboveVideo = row < videoPosition.top || row >= videoPosition.bottom || endingRow > videoPosition.bottom;
      const colAboveVideo = col < videoPosition.left || col >= videoPosition.right || endingCol > videoPosition.right;


      const shouldDraw =
        isFirstFit || isLastFit || (rowAboveVideo || colAboveVideo);
      if (!shouldDraw) continue;

      // during loop, get color and draw onto canvas
      const color = new Uint8ClampedArray(
        getAverageColor(
          frame,
          row,
          col,
          row + canvasDivision.height,
          col + canvasDivision.width
        )
      );
      if (debugColoring) {
        color[RED_CHANNEL_OFFSET] = isFirstFit ? 255 : 0;
        color[GREEN_CHANNEL_OFFSET] = isLastFit ? 255 : 0;
        color[BLUE_CHANNEL_OFFSET] = rowAboveVideo && colAboveVideo ? 255 : 0;
      }

      divisions[divisionIdx++] = {
        row,
        col,
        width: canvasDivision.width,
        height: canvasDivision.height,
        color,
      };
    }
  }

  // need to return some information to make convolution easier
  return divisions;
}

export function getAverageColor(
  frame: ImageData,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
) {
  const res = [0, 0, 0, 255];
  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const pixelIdx = ((row * frame.width + col) * 4);

      res[RED_CHANNEL_OFFSET] += frame.data[pixelIdx + RED_CHANNEL_OFFSET];
      res[GREEN_CHANNEL_OFFSET] += frame.data[pixelIdx + GREEN_CHANNEL_OFFSET];
      res[BLUE_CHANNEL_OFFSET] += frame.data[pixelIdx + BLUE_CHANNEL_OFFSET];
    }
  }

  const numPixels = (endRow - startRow) * (endCol - startCol);
  res[RED_CHANNEL_OFFSET] = Math.round(res[RED_CHANNEL_OFFSET] / numPixels);
  res[GREEN_CHANNEL_OFFSET] = Math.round(res[GREEN_CHANNEL_OFFSET] / numPixels);
  res[BLUE_CHANNEL_OFFSET] = Math.round(res[BLUE_CHANNEL_OFFSET] / numPixels);
  return res;
}

export function findVideoPositionOnCanvas(canvasDimensions: Dimensions, videoDimensions: Dimensions): Position {
  // rounding was needed since many of the divisons were black, this was because getting colors at a row/col with a 
  // decminal value is an error (there is no color there or something similar)
  const verticalPadding = Math.round((canvasDimensions.height - videoDimensions.height) / 2);
  const horizontalPadding = Math.round((canvasDimensions.width - videoDimensions.width) / 2);
  return {
    top: verticalPadding,
    right: canvasDimensions.width - horizontalPadding,
    bottom: canvasDimensions.height - verticalPadding,
    left: horizontalPadding
  }
}

/**
 * - A function that is used to smooth the color transition between divisions
 * @param srcFrame is the default canvas that holds the divison width/length colors]
 * - Defines the boundaries for region convolution
 * @param dstData is the complete convolved frame
 * @param startRow
 * @param startCol
 * @param endRow
 * @param endCol
 * @param kernel_size is how large your kernel convolution size is (higher = laggier but smoother transition)
 * @returns an ImageData
 */

export function regionConvolution(
  srcFrame: ImageData, // we use frame to ease indexing using row and height
  dstData: Uint8ClampedArray, // we use newFrame to actually change values
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  kernel_size: number,
  debugRow?: number,
  debugCol?: number
): Uint8ClampedArray {
  
  let layers = Math.floor(kernel_size / 2);

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const result = convolveRegion(
        row,
        col,
        layers,
        srcFrame,
        startRow,
        startCol,
        endRow,
        endCol,
        debugRow,
        debugCol
      );
      
      let index = (row * srcFrame.width + col) * 4;

      dstData[index] = result[RED_CHANNEL_OFFSET];
      dstData[index + GREEN_CHANNEL_OFFSET] = result[GREEN_CHANNEL_OFFSET];
      dstData[index + BLUE_CHANNEL_OFFSET] = result[BLUE_CHANNEL_OFFSET];
      dstData[index + ALPHA_CHANNEL_OFFSET] = 255;
    }
  }

  return dstData;
}

export function convolveRegion(
  row: number,
  col: number,
  layers: number,
  srcFrame: ImageData,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  debugRow?: number,
  debugCol?: number
) {

  let red = 0, blue = 0, green = 0;

  const isDebugPosition = row === debugRow && col === debugCol;
  if (isDebugPosition) {
    console.log(`Analyzing position (${row},${col})`);
  }

  for (let kernel_row = row - layers; kernel_row < row + layers + 1; kernel_row++) {
    for (let kernel_col = col - layers; kernel_col < col + layers + 1; kernel_col++) {
      const clampedRow = Math.min(Math.max(kernel_row, startRow), endRow - 1);
      const clampedCol = Math.min(Math.max(kernel_col, startCol), endCol - 1);

      const index = (clampedRow * srcFrame.width + clampedCol) * 4;

      if (isDebugPosition) {
        console.log(`Kernel pos (${kernel_row},${kernel_col}) -> Clamped (${clampedRow},${clampedCol}): RGB=[${
          srcFrame.data[index]},${srcFrame.data[index+1]},${srcFrame.data[index+2]}]`);
      }

      red += srcFrame.data[index + RED_CHANNEL_OFFSET];
      green += srcFrame.data[index + GREEN_CHANNEL_OFFSET];
      blue += srcFrame.data[index + BLUE_CHANNEL_OFFSET];
    }
  }

  if (isDebugPosition) {
    console.log(`Final values: RGB=[${red},${green},${blue}]`);
  }

  const kernelArea = (layers * 2 + 1) * (layers * 2 + 1);

  return [
    Math.round(red / kernelArea),
    Math.round(green / kernelArea), 
    Math.round(blue / kernelArea)
  ];
}
