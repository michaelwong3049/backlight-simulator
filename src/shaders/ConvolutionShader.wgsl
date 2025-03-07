struct Params { 
  horizontalDivisions: u32,
  verticalDivisions: u32,
  videoHeight: u32,
  videoWidth: u32,
  canvasWidth: u32,
  canvasHeight: u32,
}

struct Dimensions {
  width: i32,
  height: i32,
}

// 20 bytes
struct Division {
  row: i32,
  col: i32,
  width: i32,
  height: i32,
  color: u32,
}

struct Position {
  top: i32,
  bottom: i32,
  left: i32,
  right: i32,
}

// const RED_CHANNEL_OFFSET = 0
// const BLUE_CHANNEL_OFFSET = 1
// const GREEN_CHANNEL_OFFSET = 2
// const ALPHA_CHANNEL_OFFSET = 3

@group(0) @binding(0) var<storage, read_write> computeBuffer: array<u32>;
@group(0) @binding(1) var<storage, read_write> paramBuffer: Params;
// [division1 row, division1 col, division width, division1 height, division1 color, division2 row, division2 col, ...]
@group(0) @binding(2) var<storage, read_write> divisionBuffer: array<u32>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&computeBuffer)) {
    return;
  }

  // const newFrame: array<u32>; // maybe should set size? for now its dynamic
  let videoDimensions = Dimensions(i32(paramBuffer.videoWidth), i32(paramBuffer.videoHeight));
  let canvasDimensions = Dimensions(i32(paramBuffer.canvasWidth), i32(paramBuffer.canvasHeight));
  computeDivisions(
    videoDimensions,
    canvasDimensions,
    paramBuffer.horizontalDivisions,
    paramBuffer.verticalDivisions
  );

  // let convolutionRegion = Dimensions(round(divisions[0].width / 2), round(divisions[0].height / 2));

  // for(let div = 0; div < arrayLength(divisions) div += 1) {
  //   const currDiv = divisions[div];
  //   for(let row = currDiv.row; row < currDiv.row + currDiv.height; row += 1) {
  //     for(let col = currDiv.col; col < currDiv.col + currDiv.width; col += 1) {
  //       const frameIndex = (row * canvasWidth + col) * 4;
      
  //       newFrame[frameIndex + RED_CHANNEL_OFFSET] = currDiv.color[RED_CHANNEL_OFFSET];
  //       newFrame[frameIndex + GREEN_CHANNEL_OFFSET] = currDiv.color[GREEN_CHANNEL_OFFSET];
  //       newFrame[frameIndex + BLUE_CHANNEL_OFFSET] = currDiv.color[BLUE_CHANNEL_OFFSET];
  //       newFrame[frameIndex + ALPHA_CHANNEL_OFFSET] = currDiv.color[ALPHA_CHANNEL_OFFSET];
  //     }
  //   }
  // }
 
  // // convolve regions
  // for(let div = 0; div < arrayLength(divisions); div += 1) {
  //   let currDiv = divisions[div];
  //   let nextDiv = divisions[div + 1];

  //   // convolve down and right as long as we are not on the right side
  //   if(currDiv.col < nextDiv.col) {
  //     regionConvolution(
  //       // new ImageData(new Uint8ClampedArray(newFrame), frame.width, frame.height),
  //       newFrame,
  //       currDiv.row,
  //       nextDiv.col - round(convolutionRegion.width / 2),
  //       nextDiv.row + nextDiv.height,
  //       nextDiv.col + rou
  //     )nd(convolutionRegion.width / 2),
  //       3
  //   }

  //   if(currDiv.row + currDiv.height + convolutionRegion.height <= frame.height) {
  //     regionConvolution(
  //       // new ImageData(new Uint8ClampedArray(newFrame), frame.width, frame.height),
  //       newFrame,
  //       currDiv.row + convolutionRegion.height,
  //       currDiv.col,
  //       currDiv.row + currDiv.height + convolutionRegion.height,
  //       currDiv.col + currDiv.width,  
  //       3
  //     )
  //   }
  // }
  
  // // instead of return here, we should modify a buffer to "return" data
  // // return new ImageData(newFrame, frame.width, frame.height);
}

fn computeDivisions(
  videoDimensions: Dimensions,
  canvasDimensions: Dimensions,
  horizontalDivisions: u32,
  verticalDivisions: u32
) {
  // TODO: this can be float, need to cast to int
  let canvasDivision = Dimensions(
    i32(floor(f32(canvasDimensions.width) / f32(horizontalDivisions))),
    i32(floor(f32(canvasDimensions.height) / f32(verticalDivisions))),
  );

  // dynamically figure out the padding around the video assuming the video is centered
  let videoPosition = findVideoPositionOnCanvas(canvasDimensions, videoDimensions);

  var divisionIdx: u32 = 0;
  // loop through all regions with offset, smart skip if we're in video range
  // placed a -10 since without it, there would be extra divisions 
  for (var row = 0; row < canvasDimensions.height; row += canvasDivision.height) {
    for (var col = 0; col < canvasDimensions.width; col += canvasDivision.width) {

      // // these variables are needed to check whether to draw if the division is "half-in half-out" of the video and canvas
      // const endingRow = row + canvasDivision.height;
      // const endingCol = col + canvasDivision.width;

      // // === is not a thing in WGSL
      // const isFirstFit = row == 0 || col == 0;
      // const isLastFit =
      //   row + canvasDivision.height >= frame.height ||
      //   col + canvasDivision.width >= frame.width;
      // const rowAboveVideo = row < videoPosition.top || row >= videoPosition.bottom || endingRow > videoPosition.bottom;
      // const colAboveVideo = col < videoPosition.left || col >= videoPosition.right || endingCol > videoPosition.right;


      // const shouldDraw =
      //   isFirstFit || isLastFit || (rowAboveVideo || colAboveVideo);
      // if (!shouldDraw) continue;

      // during loop, get color and draw onto canvas
      let color: u32 = (
        getAverageColor(
          row,
          col,
          row + canvasDivision.height,
          col + canvasDivision.width,
          canvasDimensions
        )
      );
      
      divisionBuffer[divisionIdx] = u32(row);
      divisionIdx += 1;

      divisionBuffer[divisionIdx] = u32(col);
      divisionIdx += 1;

      divisionBuffer[divisionIdx] = u32(canvasDimensions.width);
      divisionIdx += 1;

      divisionBuffer[divisionIdx] = u32(canvasDimensions.height);
      divisionIdx += 1;

      divisionBuffer[divisionIdx] = u32(color);
      divisionIdx += 1;
    }
  }
}

fn findVideoPositionOnCanvas(canvasDimensions: Dimensions, videoDimensions: Dimensions) -> Position {
  let heightDiff: i32 = canvasDimensions.height - videoDimensions.height;
  let widthDiff: i32 = canvasDimensions.width - videoDimensions.width;

  let verticalPadding: f32 = round(f32(heightDiff) / 2);
  let horizontalPadding: f32 = round(f32(widthDiff) / 2);


  return Position(
    i32(verticalPadding),
    i32(f32(canvasDimensions.width) - horizontalPadding),
    i32(f32(canvasDimensions.height) - verticalPadding),
    i32(horizontalPadding)
  );
}

fn getAverageColor(
  startRow: i32,
  startCol: i32,
  endRow: i32,
  endCol: i32,
  canvasDimensions: Dimensions,
) -> u32 {
  var r: u32 = 0;
  var g: u32 = 0;
  var b: u32 = 0;
  var a: u32 = 255;

  for (var row = startRow; row < endRow; row += 1) {
    for (var col = startCol; col < endCol; col += 1) {
      let pixelIdx = row * canvasDimensions.width + col;
      let wonky32Number = computeBuffer[pixelIdx];

      r += (wonky32Number >> 0) & 255;
      g += (wonky32Number >> 8) & 255;
      b += (wonky32Number >> 16) & 255;
    }
  }

  let numPixels = f32((endRow - startRow) * (endCol - startCol));
  let roundedR = u32(round(f32(r) / numPixels));
  let roundedG = u32(round(f32(g) / numPixels));
  let roundedB = u32(round(f32(b) / numPixels));
  let repackedNumber: u32 = (255 << 24) | (b << 16) | (g << 8) | (r << 0);
  return repackedNumber;
}

// fn regionConvolution(
//   dstData: <u32>,
//   startRow: i32,
//   startCol: i32,
//   endRow: i32,
//   endCol: i32,
//   kernel_size: u32,
//   // excluding debugRow and debugCol
// ) -> array<u32> {
//   let layers = floor(kernel_size / 2);

//   for (let row = startRow; row < endRow; row += 1) {
//     for (let col = startCol; col < endCol; col += 1) {
//       const result = convolveRegion(
//         row,
//         col,
//         layers,
//         srcFrame,
//         startRow,
//         startCol,
//         endRow,
//         endCol,
//         debugRow,
//         debugCol
//       );
      
//       let index = (row + canvasWidth + col) * 4;

//       dstData[index] = result[RED_CHANNEL_OFFSET];
//       dstData[index + GREEN_CHANNEL_OFFSET] = result[GREEN_CHANNEL_OFFSET];
//       dstData[index + BLUE_CHANNEL_OFFSET] = result[BLUE_CHANNEL_OFFSET];
//       dstData[index + ALPHA_CHANNEL_OFFSET] = 255;
//     }
//   }

//   return dstData;
// }

// fn convolveRegion(
//   row: i32,
//   col: i32,
//   layers: i32,
//   startRow: i32,
//   startCol: i32,
//   endRow: i32,
//   endCol: i32,
//   // excluding debugRow and debugCol
// ) -> array {
//   let red = 0, blue = 0, green = 0;

//   // const isDebugPosition = row === debugRow && col === debugCol;
//   // if (isDebugPosition) {
//   //   console.log(`Analyzing position (${row},${col})`);
//   // }

//   for (let kernel_row = row - layers; kernel_row < row + layers + 1; kernel_row += 1) {
//     for (let kernel_col = col - layers; kernel_col < col + layers + 1; kernel_col += 1) {
//       const clampedRow = min(max(kernel_row, startRow), endRow - 1);
//       const clampedCol = min(max(kernel_col, startCol), endCol - 1);

//       const index = (clampedRow * canvasWidth + clampedCol) * 4;

//       red += srcFrame.data[index + RED_CHANNEL_OFFSET];
//       green += srcFrame.data[index + GREEN_CHANNEL_OFFSET];
//       blue += srcFrame.data[index + BLUE_CHANNEL_OFFSET];
//     }
//   }

//   const kernelArea = (layers * 2 + 1) * (layers * 2 + 1);

//   return [
//     round(red / kernelArea),
//     round(green / kernelArea), 
//     round(blue / kernelArea)
//   ];
// }
