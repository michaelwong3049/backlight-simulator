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
@group(1) @binding(0) var<storage, read_write> divisions: array<Division>;
@group(1) @binding(1) var<storage, read> frame: array<u32>;

var<workgroup> subdivision_sums = array<vec4<f32>, 256>; // 16x16 workgroup size
var<workgroup> subdivision_pixel_count: atomic<u32> = 0;

@compute @workgroup_size(16, 16)
fn main(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  // division is a flattened 2D array
  let division_idx = workgroup_id.y * parameters.verticalDivisions + workgroup_id.x;


}

