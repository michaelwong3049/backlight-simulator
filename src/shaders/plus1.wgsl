// Option 1: Use a struct as you intended in the comments
struct Params { 
  horizontalDivisions: u32,
  verticalDivisions: u32,
  videoHeight: u32,
  videoWidth: u32,
  canvasWidth: u32,
  canvasHeight: u32,
}

@group(0) @binding(0) var<storage, read_write> computeBuffer: array<u32>;
@group(0) @binding(1) var<storage, read_write> paramBuffer: Params;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&computeBuffer)) {
    return;
  }

  paramBuffer.horizontalDivisions += 3000;
}
