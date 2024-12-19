import { Dimensions, BacklightOptions, Division } from '@/types';
import {
  BLUE_CHANNEL_OFFSET,
  GREEN_CHANNEL_OFFSET,
  RED_CHANNEL_OFFSET,
} from '@/utils/constants';

export function computeBacklightFrame(
  // TODO: remove ctx later, we should be able to do some assignments on frame.data
  ctx: CanvasRenderingContext2D,
  frame: ImageData,
  videoDimensions: Dimensions,
  opts: BacklightOptions
) {
  const divisions = computeDivisions(
    frame,
    videoDimensions,
    opts.horizontalDivisions,
    opts.verticalDivisions,
    false
  );

  divisions.forEach((division) => {
    ctx.fillStyle = `rgb(${division.color[RED_CHANNEL_OFFSET]}, ${division.color[GREEN_CHANNEL_OFFSET]}, ${division.color[BLUE_CHANNEL_OFFSET]})`;
    ctx.fillRect(division.col, division.row, division.width, division.height);
  });

  return frame;
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
    width: frame.width / horizontalDivisions,
    height: frame.height / verticalDivisions,
  };

  // dynamically figure out the padding around the video assuming the video is centered
  const verticalPadding = (frame.height - videoDimensions.height) / 2;
  const horizontalPadding = (frame.width - videoDimensions.width) / 2;

  const videoTop = verticalPadding;
  const videoBottom = frame.height - verticalPadding;
  const videoLeft = horizontalPadding;
  const videoRight = frame.width - horizontalPadding;

  let divisionIdx = 0;
  // loop through all regions with offset, smart skip if we're in video range
  for (let row = 0; row < frame.height; row += canvasDivision.height) {
    for (let col = 0; col < frame.width; col += canvasDivision.width) {
      const isFirstFit = row === 0 || col === 0;
      const isLastFit =
        row + canvasDivision.height >= frame.height ||
        col + canvasDivision.width >= frame.width;
      const rowAboveVideo = row < videoTop || row >= videoBottom;
      const colAboveVideo = col < videoLeft || col >= videoRight;

      const shouldDraw =
        isFirstFit || isLastFit || (rowAboveVideo && colAboveVideo);
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
      const pixelIdx = (row * frame.width + col) * 4;

      res[RED_CHANNEL_OFFSET] += frame.data[pixelIdx + RED_CHANNEL_OFFSET];
      res[GREEN_CHANNEL_OFFSET] += frame.data[pixelIdx + GREEN_CHANNEL_OFFSET];
      res[BLUE_CHANNEL_OFFSET] += frame.data[pixelIdx + BLUE_CHANNEL_OFFSET];
    }
  }
  const numPixels = (endRow - startRow) * (endCol - startCol);
  res[RED_CHANNEL_OFFSET] /= numPixels;
  res[GREEN_CHANNEL_OFFSET] /= numPixels;
  res[BLUE_CHANNEL_OFFSET] /= numPixels;

  return res;
}

/**
 * - A function that is used to smooth the color transition between divisions
 * @param frame is the default canvas that holds the divison width/length colors]
 * - Defines the boundaries for region convolution
 * @param startRow
 * @param startCol
 * @param endRow
 * @param endCol
 * @param kernel_size is how large your kernel convolution size is (higher = laggier but smoother transition)
 * @returns an ImageData
 */

export function regionConvolution(
  frame: ImageData,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  kernel_size: number
): ImageData {
  const frameCopy = new Uint8ClampedArray(frame.data.length);
  let layers = Math.floor(kernel_size / 2);
  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      let currentPixel = frame.data[(row * frame.width + col) * 4];

      const result = convolveRegion(
        row,
        col,
        layers,
        frame,
        startRow,
        startCol,
        endRow,
        endCol
      );

      frameCopy[currentPixel++] = (result[0] / kernel_size) * kernel_size;
      frameCopy[currentPixel++] = (result[1] / kernel_size) * kernel_size;
      frameCopy[currentPixel++] = (result[2] / kernel_size) * kernel_size;
      frameCopy[currentPixel++] = (result[3] / kernel_size) * kernel_size;
    }
  }

  return new ImageData(frameCopy, endRow - startRow, endCol - startCol);
}

export function convolveRegion(
  row: number,
  col: number,
  layers: number,
  frame: ImageData,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
) {
  let red = 0, blue = 0, green = 0, alpha = 255;
  for (let kernel_row = row - layers; kernel_row < row + layers + 1; kernel_row++) {
    for (
      let kernel_col = col - layers;
      kernel_col < col + layers + 1;
      kernel_col++
    ) {
      const rowOutOfBounds = row - layers < startRow || row + layers >= endRow;
      const columnOutOfBounds =
        col - layers < startCol || col + layers >= endCol;
      if (rowOutOfBounds || columnOutOfBounds) {
        continue;
      }

      let currentKernelPixel =
        frame.data[(kernel_row * frame.width + kernel_col) * 4];

      red += frame.data[currentKernelPixel++];
      green += frame.data[currentKernelPixel++];
      blue += frame.data[currentKernelPixel++];
      alpha += frame.data[currentKernelPixel++];
    }
  }

  return [red, green, blue, alpha];
}