import type { Dimensions, BacklightOptions, Division, Position } from '@/types';
import {
  ALPHA_CHANNEL_OFFSET,
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
  const newFrame = new Uint8ClampedArray(frame.data.length);
  const divisions = computeDivisions(
    frame,
    videoDimensions,
    opts.horizontalDivisions,
    opts.verticalDivisions,
    false
  );
  const oneFourthDivWidth = Math.round(divisions[0].width / 4);
  const oneFourthDivHeight = Math.round(divisions[0].height / 4);

  for(let div = 0; div < divisions.length; div += 2) {
    const currDiv = divisions[div];
    const nextDiv = divisions[div + 1];

    // setting all the divs to hav the averaged colors
    for (let row = currDiv.row; row < currDiv.row + currDiv.height; row++) {
      for (let col = currDiv.col; col < currDiv.col + currDiv.width; col++) {
        const frameIndex = (row * frame.width + col) * 4;

        newFrame[frameIndex + RED_CHANNEL_OFFSET] = currDiv.color[RED_CHANNEL_OFFSET];
        newFrame[frameIndex + GREEN_CHANNEL_OFFSET] = currDiv.color[GREEN_CHANNEL_OFFSET];
        newFrame[frameIndex + BLUE_CHANNEL_OFFSET] = currDiv.color[BLUE_CHANNEL_OFFSET];
        newFrame[frameIndex + ALPHA_CHANNEL_OFFSET] = currDiv.color[ALPHA_CHANNEL_OFFSET];
      }
    }

    // set the nextDiv to have its respective average color
    for (let row = nextDiv.row; row < nextDiv.row + nextDiv.height; row++) {
      for (let col = nextDiv.col; col < nextDiv.col + nextDiv.width; col++) {
        const frameIndex = (row * frame.width + col) * 4;

        newFrame[frameIndex + RED_CHANNEL_OFFSET] = nextDiv.color[RED_CHANNEL_OFFSET];
        newFrame[frameIndex + GREEN_CHANNEL_OFFSET] = nextDiv.color[GREEN_CHANNEL_OFFSET];
        newFrame[frameIndex + BLUE_CHANNEL_OFFSET] = nextDiv.color[BLUE_CHANNEL_OFFSET];
        newFrame[frameIndex + ALPHA_CHANNEL_OFFSET] = nextDiv.color[ALPHA_CHANNEL_OFFSET];
      }
    }
    
    // attempting to call regionConvolution to the right at the top row
    if(!(nextDiv.col + nextDiv.width >= frame.width)) {
      regionConvolution(frame, newFrame, currDiv.row, nextDiv.col - oneFourthDivWidth, currDiv.row + currDiv.height, nextDiv.col + oneFourthDivWidth, 3);
    }

  }
  /**
   * SECOND POSSIBLE METHOD FOR CALLING REGIONCONVOLUTION:
   * after coloring all of the divisions to their respective average colors,
   * we can call region convolution on ALL divisons in the DOWN and RIGHT
   * directions UNLESS they are touching the right or bottom side, if they do 
   * then we can call it either just going down or to the right respectively.
   */
  // setting the colors for each division first
  // for(let div = 0; div < divisions.length; div++) {
  //   const currDiv = divisions[div];

  //   for(let row = currDiv.row; row < currDiv.row + currDiv.height; row++) {
  //     for(let col = currDiv.col; col < currDiv.col + currDiv.width; col++) {
  //       const frameIndex = (row * frame.width + col) * 4;
      
  //       newFrame[frameIndex + RED_CHANNEL_OFFSET] = currDiv.color[RED_CHANNEL_OFFSET];
  //       newFrame[frameIndex + GREEN_CHANNEL_OFFSET] = currDiv.color[GREEN_CHANNEL_OFFSET];
  //       newFrame[frameIndex + BLUE_CHANNEL_OFFSET] = currDiv.color[BLUE_CHANNEL_OFFSET];
  //       newFrame[frameIndex + ALPHA_CHANNEL_OFFSET] = currDiv.color[ALPHA_CHANNEL_OFFSET];
  //     }
  //   }
  // }

  // for(let div = 0; div < divisions.length; div++) {
  //   let currDiv = divisions[div];
  //   let nextDiv = divisions[div + 1];
  // }


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
 * @param frame is the default canvas that holds the divison width/length colors]
 * - Defines the boundaries for region convolution
 * @param newFrame is the complete convolved frame
 * @param startRow
 * @param startCol
 * @param endRow
 * @param endCol
 * @param kernel_size is how large your kernel convolution size is (higher = laggier but smoother transition)
 * @returns an ImageData
 */

export function regionConvolution(
  frame: ImageData, // we use frame to ease indexing using row and height
  newFrame: Uint8ClampedArray, // we use newFrame to actually change values
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number,
  kernel_size: number
): Uint8ClampedArray {
  let layers = Math.floor(kernel_size / 2);

  for (let row = startRow; row < endRow; row++) {
    for (let col = startCol; col < endCol; col++) {
      const result = convolveRegion(
        row,
        col,
        layers,
        frame,
        newFrame,
        startRow,
        startCol,
        endRow,
        endCol
      );

      let index = (row * frame.width + col) * 4;

      newFrame[index] = result[RED_CHANNEL_OFFSET] / (kernel_size * kernel_size);
      newFrame[index + GREEN_CHANNEL_OFFSET] = result[GREEN_CHANNEL_OFFSET] / (kernel_size * kernel_size);
      newFrame[index + BLUE_CHANNEL_OFFSET] = result[BLUE_CHANNEL_OFFSET] / (kernel_size * kernel_size);
      newFrame[index + ALPHA_CHANNEL_OFFSET] = 255;
    }
  }

  return newFrame;
}

export function convolveRegion(
  row: number,
  col: number,
  layers: number,
  frame: ImageData,
  newFrame: Uint8ClampedArray,
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
) {

  let red = 0, blue = 0, green = 0;
  for (let kernel_row = row - layers; kernel_row < row + layers + 1; kernel_row++) {
    for (let kernel_col = col - layers; kernel_col < col + layers + 1; kernel_col++) {
      const rowOutOfBounds = kernel_row < startRow || kernel_row >= endRow;
      const columnOutOfBounds = kernel_col < startCol || kernel_col >= endCol;
      if (rowOutOfBounds || columnOutOfBounds) {
        continue;
      }

      let index = (kernel_row * frame.width + kernel_col) * 4;
      red += newFrame[index + RED_CHANNEL_OFFSET];
      green += newFrame[index + GREEN_CHANNEL_OFFSET];
      blue += newFrame[index + BLUE_CHANNEL_OFFSET];
    }
  }

  return [red, green, blue];
}
