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

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f
}

@vertex fn vertexMain(
  @builtin(vertex_index) vertexIndex : u32
) -> VertexOutput {
    var output: VertexOutput;

    let pos = array(
      vec2f( -1.0,  -1.0 ),  // top center
      vec2f( 3.0, -1.0 ),  // bottom left
      vec2f( -1.0, 3.0 )   // bottom right
    );

    let uv = array(
      vec2f(0.0, 1.0),   // Bottom-left of texture
      vec2f(2.0, 1.0),   // Off the texture (gets clamped)
      vec2f(0.0, -1.0)   // Off the texture (gets clamped)
    );

    output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
    output.uv = uv[vertexIndex];

    return output;
  }

@group(0) @binding(0) var outputTexture: texture_2d<f32>;

@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // Convert UV (0.0-1.0) to pixel coordinates
  let dimensions = textureDimensions(outputTexture);
  let pixelCoord = vec2<i32>(i32(input.uv.x * f32(dimensions.x)), i32(input.uv.y * f32(dimensions.y)));
  
  // Load exact pixel (no filtering)
  return textureLoad(outputTexture, pixelCoord, 0);
  // return vec4f(1.0, 0.0, 0.0, 1.0);
}

// [division1 row, division1 col, division width, division1 height, division1 color, division2 row, division2 col, ...]
// @group(0) @binding(2) var<storage, read_write> divisionBuffer: array<u32>;

/**
  Demonstration of how workgroup logic:
  3 horizontal, 3 vertical

  a b c
  d e f
  g h i

  a b c d e f g h i

  workgroup.xy -> a division letter

  workgroup.00 -> a
  .01 -> b
  .12 -> f
*/

// computeMain(workgroup = [0, 0, 0]) -> workgroup_id: division
  // computeMain(workgroup=00, thread=00)
  // computeMain(workgroup=00, thread=01)
  // computeMain(workgroup=00, thread=02)
  // computeMain(workgroup=00, thread=10)

// computeMain(workgroup = [0, 1, 0])
// computeMain(workgroup = [0, 2, 0])

@group(0) @binding(0) var<storage, read_write> settingsBuffer: Params;
@group(0) @binding(1) var<storage, read_write> colorDivisionOutBuffer: array<u32>;
@group(1) @binding(0) var videoImageData: texture_2d<f32>;
@group(1) @binding(1) var videoOutputTexture: texture_storage_2d<rgba8unorm, write>;

// recall: the workergroups that we are using here are like a 3d array of threads, where each row would be the workergroup and each column would be the thread 
@compute @workgroup_size(16, 16, 1)
fn computeMain(
  // --- all these id's are used for the position of the current thread that you are working with --- 
  // global position for a thread across the entire dispatch
  @builtin(global_invocation_id) global_id: vec3<u32>,
  // the workgroup that the thread belongs to
  @builtin(workgroup_id) workgroup_id: vec3<u32>, // [x, y, z] 0, 1, 1 
  // the position of the thread in relation to the workgroup
  @builtin(local_invocation_id) thread_id: vec3<u32>, // [xyz]
) {
  // what division is my workgroup responsible for?
  let division_idx = i32(workgroup_id.x + (settingsBuffer.horizontalDivisions * workgroup_id.y));
  let division_height = ceil(f32(settingsBuffer.canvasHeight) / f32(settingsBuffer.verticalDivisions));
  let division_width = ceil(f32(settingsBuffer.canvasWidth) / f32(settingsBuffer.horizontalDivisions));

  // at this point we know everything about our division (height, width, idx)

  // what pixel does my division start on?
  let startRow: i32 = i32(f32(workgroup_id.y) * division_height);
  let startCol: i32 = i32(f32(workgroup_id.x) * division_width);
  let endRow: i32 = startRow + i32(division_height);
  let endCol: i32 = startCol + i32(division_width);

  // the sum of the rgb for a particular thread
  var this_thread_color_sum = vec4<u32>(0); // rgba [r,g,b,a]
  var this_thread_pixel_count: u32 = 0;

  // based on my thread, stride loop through the division
  // and update MY color sum AND MY count
  /*
    for (each pixel in frameData) {
      if (idx % my_thread_# == 0) {
        update red in this_thread_color_sum
      }
    }
  */

  // p1 = [255,24, 32, 16]
  // p2 = [255,24, 32, 16]
  // workgroup size = 2x2x1, ARRAY LENGTH = 20;
  // for(var x = 0; x < arr.length; x += 4)
  // thread 0 -> 0, 4,  8, 12, 16
  // thread 1 -> 1, 5,  9, 13, 17
  // thread 2 -> 2, 6, 10, 14, 18
  // thread 3 -> 3, 7, 11, 15, 19

  // ^^^ so thread 0 would be responsible for pixel 0, pixel 4, pixel 12 --> this is cuz:
  // we packed uint8clapmedarray to Uint32array --> meaning we have 4 bytes for 1 pixel -->

  const num_threads = 16;
  /*
   howcome its thread_id.y and x?

   we start the row at thread.y and the col at thread.x
   if you had 2x2x1 workgroup size,

   thread 00 -> would start idx(0, 0)
   thread 01 -> idx(0, 1)
   thread 10 -> idx(1, 0)
   thread 11 -> idx(1, 1)

   thread 00 -> idx(0, 0), idx(0, 0) + # of threads

    if i was thread #0 and there were 3 thread total, i would take every multiple
    of 3 starting from 0. 0, 3, 6, 9

    if i was thread #1 i would 1, 4, 7, 10
  */

  for (var row = thread_id.y; row < u32(division_height); row += num_threads) {
    for (var col = thread_id.x; col < u32(division_width); col += num_threads) {
      // im concerned with this row += num_threads...
      // we are passing frame.data (uint8clamped) to the computeBuffer here and we are not packing this as Uint32? might be errors
      let texture_x = i32(startCol + i32(col));
      let texture_y = i32(startRow + i32(row));
      
      // Check bounds
      if (texture_y >= endRow || texture_x >= endCol) {
        continue;
      }

      // let pixel_idx = i32(row * u32(division_width) + col);
      // if (pixel_idx >= endRow) {
      //   continue;
      // }

      // let color = computeBuffer[pixel_idx]; // packed u32
      // let color = textureLoad(videoImageData, global_id.xy, 0);
      let color = textureLoad(videoImageData, vec2<i32>(texture_x, texture_y), 0);

      // var split_color: vec4<u32> = unpackRGBA(color);

      // this_thread_color_sum.r += split_color.r;
      // this_thread_color_sum.g += split_color.g;
      // this_thread_color_sum.b += split_color.b;
      this_thread_color_sum.r += u32(color.r * 255.0);
      this_thread_color_sum.b += u32(color.b * 255.0);
      this_thread_color_sum.g += u32(color.g * 255.0);
      this_thread_pixel_count += 1;
    }
  }

  // force waits until every thread gets to this point
  workgroupBarrier();

  // by this each thread (0, 1, 2, 3) knows its own color sum and pixel count
  // how do we sum them up?

  // create another color sum and have each thread update this single sum
  // 256 represents the size of the array since 16*16
  var workgroup_color_sum: array<vec4<u32>, 256>;
  var workgroup_pixel_count: array<u32, 256>;

  // figure if i'm a 2D thread, whats my 1D workgroup_color_sum index?
  var thread_color_index = thread_id.x + (16 * thread_id.y);

  // in the workgroup-level array, share this thread's color sum and pixel count
  workgroup_color_sum[thread_color_index] = this_thread_color_sum;
  workgroup_pixel_count[thread_color_index] = this_thread_pixel_count;
  
  // how do reduce the workgroup-level array to a single color sum and pixel count?
  // hint: i want to do this in a gpu-smart way  

  workgroupBarrier();

  // workgroup_color_sum = [  thread0.rgb, thread1.rgb, thread2.rgb, thread3.rgb ]
  // workgroup_pixel_count = [ thread0.count, thread1.count, thread2.count, thread3.count ]
  for (var offset: u32 = 128; offset > 0; offset /= 2) {
    // we need each thread to "collapse its partner" before we continue
    workgroupBarrier();

    // left index - this will contain self.color + right.color
    var left_index = thread_color_index;

    // right index is the value to bring to the left
    var right_index = thread_color_index + offset;

    // collapse them
    if (thread_color_index < offset) {
      workgroup_color_sum[left_index] += workgroup_color_sum[right_index];
      workgroup_pixel_count[left_index] += workgroup_pixel_count[right_index];
    }
  }

  // at this point, all of the color_sum and pixel count 
  // are in workgroup_arr[0];
  let avg_r = ceil(f32(workgroup_color_sum[0].r) / f32(workgroup_pixel_count[0]));
  let avg_g = ceil(f32(workgroup_color_sum[0].g) / f32(workgroup_pixel_count[0]));
  let avg_b = ceil(f32(workgroup_color_sum[0].b) / f32(workgroup_pixel_count[0]));
  var color_array = vec4<f32>(f32(avg_r) / 255.0, f32(avg_g) / 255.0, f32(avg_b) / 255.0, 255);
  // divisionBuffer[division_idx] = u32(repackRBGA(color_array));

  // we have to store every pixel for each division in this new texture right?
  for (var row = thread_id.y; row < u32(division_height); row += 1) {
    for (var col = thread_id.x; col < u32(division_width); col += 1) {
      let texture_x = i32(startCol + i32(col));
      let texture_y = i32(startRow + i32(row));
      
      // Check bounds
      if (texture_y >= endRow || texture_x >= endCol) {
        continue;
      }

      textureStore(videoOutputTexture, vec2<i32>(texture_x, texture_y), color_array);
    }
  }
  // colorDivisionOutBuffer[division_idx] = u32(repackRBGA(color_array));

  // divisionBuffer[(division_idx * 5)] = u32(startRow);
  // divisionBuffer[(division_idx * 5) + 1] = u32(startCol);
  // divisionBuffer[(division_idx * 5) + 2] = u32(ceil(f32(paramBuffer.videoWidth) / f32(paramBuffer.horizontalDivisions)));
  // divisionBuffer[(division_idx * 5) + 3] = u32(ceil(f32(paramBuffer.videoHeight) / f32(paramBuffer.verticalDivisions)));
  // divisionBuffer[(division_idx * 5) + 4] = u32(repackRBGA(color_array));
  // --- DONE ---
}

// takes a u32 number -> returns a vec4 of rgba
fn unpackRGBA(color: u32) -> vec4<u32> {
  var color_array: vec4<u32>;

  /*
  11111111 = 255
  00000000 00000000 00000000 00000001 --> uint32 for 1
  00000000 00000000 00000000 11111111 --> uint32 255
  = 00000000 00000000 00000000 00000001 --> uint32 for 1

  bitwise &
  00000000 00000000 00000000 11111111 --> uint32 255
 =00000000 00000000 00000000 00000001 --> uint32 for 4278190081
 =00000000 00000000 00000000 00000001 --> uint32 for 4278190081

  bitwise & with 255
  00000000 00000000 00000000 11111111 --> uint32 for 4278190081
  00000000 00000000 00000000 11111111 --> uint32 255
  = 00000000 00000000 00000000 11111111 --> uint32 255
  */

  color_array.r = color & 255;
  color_array.g = (color >> 8) & 255;
  color_array.b = (color >> 16) & 255;
  color_array.a = (color >> 24) & 255;

  return color_array;
}

fn repackRBGA(color_array: vec4<u32>) -> u32 {
  var color: u32 = 0;

  color = (color_array.a << 24) | color;
  color = (color_array.b << 16) | color;
  color = (color_array.g << 8) | color;
  color = color_array.r | color;

  return color;
}

  
  // const newFrame: array<u32>; // maybe should set size? for now its dynamic
  // let videoDimensions = Dimensions(i32(paramBuffer.videoWidth), i32(paramBuffer.videoHeight));
  // let canvasDimensions = Dimensions(i32(paramBuffer.canvasWidth), i32(paramBuffer.canvasHeight));
  // computeDivisions(
  //   videoDimensions,
  //   canvasDimensions,
  //   paramBuffer.horizontalDivisions,
  //   paramBuffer.verticalDivisions
  // );

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


// fn computeDivisions(
//   videoDimensions: Dimensions,
//   canvasDimensions: Dimensions,
//   horizontalDivisions: u32,
//   verticalDivisions: u32
// ) {
//   // TODO: this can be float, need to cast to int
//   let canvasDivision = Dimensions(
//     i32(floor(f32(canvasDimensions.width) / f32(horizontalDivisions))),
//     i32(floor(f32(canvasDimensions.height) / f32(verticalDivisions))),
//   );

//   // dynamically figure out the padding around the video assuming the video is centered
//   let videoPosition = findVideoPositionOnCanvas(canvasDimensions, videoDimensions);

//   var divisionIdx: u32 = 0;
//   // loop through all regions with offset, smart skip if we're in video range
//   // placed a -10 since without it, there would be extra divisions 
//   for (var row = 0; row < canvasDimensions.height; row += canvasDivision.height) {
//     for (var col = 0; col < canvasDimensions.width; col += canvasDivision.width) {

//       // // these variables are needed to check whether to draw if the division is "half-in half-out" of the video and canvas
//       // const endingRow = row + canvasDivision.height;
//       // const endingCol = col + canvasDivision.width;

//       // // === is not a thing in WGSL
//       // const isFirstFit = row == 0 || col == 0;
//       // const isLastFit =
//       //   row + canvasDivision.height >= frame.height ||
//       //   col + canvasDivision.width >= frame.width;
//       // const rowAboveVideo = row < videoPosition.top || row >= videoPosition.bottom || endingRow > videoPosition.bottom;
//       // const colAboveVideo = col < videoPosition.left || col >= videoPosition.right || endingCol > videoPosition.right;


//       // const shouldDraw =
//       //   isFirstFit || isLastFit || (rowAboveVideo || colAboveVideo);
//       // if (!shouldDraw) continue;

//       // during loop, get color and draw onto canvas
//       let color: u32 = (
//         getAverageColor(
//           row,
//           col,
//           row + canvasDivision.height,
//           col + canvasDivision.width,
//           canvasDimensions
//         )
//       );
      
//       divisionBuffer[divisionIdx] = u32(row);
//       divisionIdx += 1;

//       divisionBuffer[divisionIdx] = u32(col);
//       divisionIdx += 1;

//       divisionBuffer[divisionIdx] = u32(canvasDimensions.width);
//       divisionIdx += 1;

//       divisionBuffer[divisionIdx] = u32(canvasDimensions.height);
//       divisionIdx += 1;

//       divisionBuffer[divisionIdx] = u32(color);
//       divisionIdx += 1;
//     }
//   }
// }

// fn findVideoPositionOnCanvas(canvasDimensions: Dimensions, videoDimensions: Dimensions) -> Position {
//   let heightDiff: i32 = canvasDimensions.height - videoDimensions.height;
//   let widthDiff: i32 = canvasDimensions.width - videoDimensions.width;

//   let verticalPadding: f32 = round(f32(heightDiff) / 2);
//   let horizontalPadding: f32 = round(f32(widthDiff) / 2);


//   return Position(
//     i32(verticalPadding),
//     i32(f32(canvasDimensions.width) - horizontalPadding),
//     i32(f32(canvasDimensions.height) - verticalPadding),
//     i32(horizontalPadding)
//   );
// }

// fn getAverageColor(
//   startRow: i32,
//   startCol: i32,
//   endRow: i32,
//   endCol: i32,
//   canvasDimensions: Dimensions,
// ) -> u32 {
//   var r: u32 = 0;
//   var g: u32 = 0;
//   var b: u32 = 0;
//   var a: u32 = 255;

//   for (var row = startRow; row < endRow; row += 1) {
//     for (var col = startCol; col < endCol; col += 1) {
//       let pixelIdx = row * canvasDimensions.width + col;
//       let wonky32Number = computeBuffer[pixelIdx];

//       r += (wonky32Number >> 0) & 255;
//       g += (wonky32Number >> 8) & 255;
//       b += (wonky32Number >> 16) & 255;
//     }
//   }

//   let numPixels = f32((endRow - startRow) * (endCol - startCol));
//   let roundedR = u32(round(f32(r) / numPixels));
//   let roundedG = u32(round(f32(g) / numPixels));
//   let roundedB = u32(round(f32(b) / numPixels));
//   let repackedNumber: u32 = (255 << 24) | (b << 16) | (g << 8) | (r << 0);
//   return repackedNumber;
// }

// // fn regionConvolution(
// //   dstData: <u32>,
// //   startRow: i32,
// //   startCol: i32,
// //   endRow: i32,
// //   endCol: i32,
// //   kernel_size: u32,
// //   // excluding debugRow and debugCol
// // ) -> array<u32> {
// //   let layers = floor(kernel_size / 2);

// //   for (let row = startRow; row < endRow; row += 1) {
// //     for (let col = startCol; col < endCol; col += 1) {
// //       const result = convolveRegion(
// //         row,
// //         col,
// //         layers,
// //         srcFrame,
// //         startRow,
// //         startCol,
// //         endRow,
// //         endCol,
// //         debugRow,
// //         debugCol
// //       );
      
// //       let index = (row + canvasWidth + col) * 4;

// //       dstData[index] = result[RED_CHANNEL_OFFSET];
// //       dstData[index + GREEN_CHANNEL_OFFSET] = result[GREEN_CHANNEL_OFFSET];
// //       dstData[index + BLUE_CHANNEL_OFFSET] = result[BLUE_CHANNEL_OFFSET];
// //       dstData[index + ALPHA_CHANNEL_OFFSET] = 255;
// //     }
// //   }

// //   return dstData;
// // }

// // fn convolveRegion(
// //   row: i32,
// //   col: i32,
// //   layers: i32,
// //   startRow: i32,
// //   startCol: i32,
// //   endRow: i32,
// //   endCol: i32,
// //   // excluding debugRow and debugCol
// // ) -> array {
// //   let red = 0, blue = 0, green = 0;

// //   // const isDebugPosition = row === debugRow && col === debugCol;
// //   // if (isDebugPosition) {
// //   //   console.log(`Analyzing position (${row},${col})`);
// //   // }

// //   for (let kernel_row = row - layers; kernel_row < row + layers + 1; kernel_row += 1) {
// //     for (let kernel_col = col - layers; kernel_col < col + layers + 1; kernel_col += 1) {
// //       const clampedRow = min(max(kernel_row, startRow), endRow - 1);
// //       const clampedCol = min(max(kernel_col, startCol), endCol - 1);

// //       const index = (clampedRow * canvasWidth + clampedCol) * 4;

// //       red += srcFrame.data[index + RED_CHANNEL_OFFSET];
// //       green += srcFrame.data[index + GREEN_CHANNEL_OFFSET];
// //       blue += srcFrame.data[index + BLUE_CHANNEL_OFFSET];
// //     }
// //   }

// //   const kernelArea = (layers * 2 + 1) * (layers * 2 + 1);

// //   return [
// //     round(red / kernelArea),
// //     round(green / kernelArea), 
// //     round(blue / kernelArea)
// //   ];
// // }
