@group(0) @binding(0) var<storage, read_write> computeBuffer: array<u32>;

@compute @workgroup_size(64)
fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&computeBuffer)) {
    return;
  }
}