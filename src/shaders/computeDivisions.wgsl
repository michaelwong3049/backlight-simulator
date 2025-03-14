// canvas width 1497x775
// workgroup size = 16x16
// one workgroup per division

struct Parameters {
  horizontalDivisions: f32,
  verticalDivisions: f32,
  videoWidth: f32,
  videoHeight: f32,
  canvasWidth: f32,
  canvasHeight: f32,
};

struct Division {
  row: i32,
  col: i32,
  width: i32,
  height: i32,
  color: u32,
};

@group(0) @binding(0) var<uniform> parameters: Parameters;
@group(0) @binding(1) var<storage, read_write> divisions: array<Division>;
@group(0) @binding(2) var<storage, read_write> inputFrameData: array<u32>;
@group(0) @binding(3) var<storage, read_write> outputFrameData: array<u32>;

@compute @workgroup_size(16, 16)
fn main(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  // find the division this workgroup is responsible for
  let division_idx = workgroup_id.y * u32(parameters.verticalDivisions) + workgroup_id.x;
  let current_division = &divisions[division_idx];

  // calculate how big each division is, can this happen on the CPU?
  let division_width = u32(round(parameters.canvasWidth / parameters.horizontalDivisions));
  let division_height = u32(round(parameters.canvasHeight / parameters.verticalDivisions));
  
  // figure out what pixel this workgroup starts from
  let start_row = workgroup_id.y * division_height;
  let start_col = workgroup_id.x * division_width;

  // a thread-level vec4 for summed rgba values
  var thread_color_sum = vec4<f32>(0);
  var thread_pixel_count = 0u;

  // this thread "strides" through the division and gets the average
  for (var row = local_id.y; row < division_height; row += 16) {
    for (var col = local_id.x; col < division_width; col += 16) {
      let pixel_idx = (start_row + row) * u32(parameters.canvasWidth) + (start_col + col);
      let split_colors = unpackRGBA(inputFrameData[pixel_idx]);
      thread_color_sum += split_colors;
      thread_pixel_count += 1u;
    }
  }

  // each thread adds its count and average color to a workgroup-level array
  var workgroup_color_sums: array<vec4<f32>, 256>;
  var workgroup_pixel_counts: array<u32, 256>;

  // local thread id is 2D, flatten it to 1D
  let local_idx = local_id.y * 16 + local_id.x;
  workgroup_color_sums[local_idx] = thread_color_sum;
  workgroup_pixel_counts[local_idx] = thread_pixel_count;

  // reduce the workgroup-level color sum and pixel count by "striding"
  for (var stride = 128u; stride > 0; stride /= 2u) {
    // we need all threads to be synced before aggregating all of their information
    workgroupBarrier();

    // collapse the values of my next stride
    if (local_idx < stride) {
      workgroup_color_sums[local_idx] += workgroup_color_sums[local_idx + stride];
      workgroup_pixel_counts[local_idx] += workgroup_pixel_counts[local_idx + stride];
    }
  }

  // all of the thread-level math has been aggregated into the workgroup-level array
  // get the final color
  let packed_color = packRGBA(workgroup_color_sums[0] / f32(workgroup_pixel_counts[0]));
  divisions[division_idx] = Division(
    0, 0,
    0, 0,
    packed_color
  );

  // this thread "strides" through the division and sets the color
  for (var row = local_id.y; row < division_height; row += 16) {
    for (var col = local_id.x; col < division_width; col += 16) {
      let pixel_idx = (start_row + row) * u32(parameters.canvasWidth) + (start_col + col);
      inputFrameData[pixel_idx] = packed_color;
    }
  }
}


// Helper function to unpack an RGBA u32 pixel into a vec4<f32>
fn unpackRGBA(packedColor: u32) -> vec4<f32> {
  let r = f32((packedColor >> 0u) & 0xFFu);
  let g = f32((packedColor >> 8u) & 0xFFu);
  let b = f32((packedColor >> 16u) & 0xFFu);
  let a = f32((packedColor >> 24u) & 0xFFu);
  return vec4<f32>(r, g, b, a);
}

fn packRGBA(unpackedColor: vec4<f32>) -> u32 {
  let r = u32(round(unpackedColor.r));
  let g = u32(round(unpackedColor.g));
  let b = u32(round(unpackedColor.b));
  let a = u32(round(unpackedColor.a));

  return (r << 24u) | (g << 16u) | (b << 8u) | a;
}
