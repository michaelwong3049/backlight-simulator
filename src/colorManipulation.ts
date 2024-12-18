import { Dimensions, BacklightOptions, Division } from '@/types';

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

  divisions.forEach((division, idx) => {
    ctx.fillStyle = `rgb(${division.color[0]}, ${division.color[1]}, ${division.color[2]})`;
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
        color[0] = isFirstFit ? 255 : 0;
        color[1] = isLastFit ? 255 : 0;
        color[2] = rowAboveVideo && colAboveVideo ? 255 : 0;
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
      const p = getPixel(frame, row, col);

      res[0] += p[0];
      res[1] += p[1];
      res[2] += p[2];
    }
  }
  const numPixels = (endRow - startRow) * (endCol - startCol);
  res[0] /= numPixels;
  res[1] /= numPixels;
  res[2] /= numPixels;

  return res;
}

// TODO: convenience method, but if we're worried about perf we can remove and just direct index access
function getPixel(frame: ImageData, row: number, col: number) {
  // TODO: could be a better index OOB handling
  if (row < 0 || row >= frame.height || col < 0 || col >= frame.width) {
    console.error(
      `Index out of bounds error during pixel access in ImageData! Attempted to get pixel at (row: ${row}, col: ${col})`
    );
    return EMPTY_PIXEL;
  }

  const truePixelIdx = (row * frame.width + col) * 4;
  return frame.data.slice(truePixelIdx, truePixelIdx + 4);
}

const EMPTY_PIXEL = [0, 0, 0, 255];
