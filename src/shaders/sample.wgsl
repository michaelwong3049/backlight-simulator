@compute @workgroup_size(16, 16)
fn main(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  // This workgroup handles division (workgroup_id.x, workgroup_id.y)
  let divisionIndex = workgroup_id.y * params.horizontalDivisions + workgroup_id.x;
  
  // Calculate division boundaries
  let divisionWidth = params.width / params.horizontalDivisions;
  let divisionHeight = params.height / params.verticalDivisions;
  let startX = workgroup_id.x * divisionWidth;
  let startY = workgroup_id.y * divisionHeight;
  
  // Use parallel reduction pattern within workgroup
  // Each thread processes multiple pixels
  var sum = vec4<f32>(0.0);
  var count = 0u;
  
  // Stride through division pixels with all threads in workgroup
  for (var y = local_id.y; y < divisionHeight; y += 16) {
    for (var x = local_id.x; x < divisionWidth; x += 16) {
      let pixelIndex = (startY + y) * params.width + (startX + x);
      sum += vec4<f32>(inputFrameData[pixelIndex]);
      count += 1u;
    }
  }
  
  // Use workgroup shared memory for reduction
  var sharedSum: array<vec4<f32>, 256>;
  var sharedCount: array<u32, 256>;
  
  let localIndex = local_id.y * 16 + local_id.x;
  sharedSum[localIndex] = sum;
  sharedCount[localIndex] = count;
  
  // Parallel reduction within workgroup
  for (var stride = 128; stride > 0; stride /= 2) {
    workgroupBarrier();
    if (localIndex < stride) {
      sharedSum[localIndex] += sharedSum[localIndex + stride];
      sharedCount[localIndex] += sharedCount[localIndex + stride];
    }
  }
  
  // Thread 0 writes the final result
  if (localIndex == 0) {
    let avgColor = sharedSum[0] / f32(sharedCount[0]);
    divisions[divisionIndex].avgColor = avgColor;
  }
}