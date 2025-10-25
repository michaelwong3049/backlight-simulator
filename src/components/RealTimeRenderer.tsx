// import { useEffect, useRef } from 'react';
// import { useWebGPU, ResourceType } from '../hooks/useWebGPU';

// const RealtimeRenderer = () => {
//   const canvasRef = useRef(null);
//   const rafId = useRef(null);

//   const {
//     gpuReady,
//     device,
//     buffers,
//     dispatch,
//     createBuffer
//   } = useWebGPU({
//     shaderModule: `
//       @group(0) @binding(0) var<storage, read_write> computeBuffer: array<f32>;
//       @group(0) @binding(1) var<storage, read_write> renderBuffer: array<f32>;

//       @compute @workgroup_size(64)
//       fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
//         let idx = global_id.x;
//         if (idx >= arrayLength(&computeBuffer)) {
//           return;
//         }
//         // Your computation here
//         renderBuffer[idx] = computeBuffer[idx] * 2.0;
//       }
//     `,
//     pipelineConfig: {
//       type: 'compute',
//       computeEntryPoint: 'computeMain'
//     },
//     resources: [
//       {
//         type: ResourceType.BUFFER,
//         name: 'computeBuffer',
//         size: 1024,
//         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
//       },
//       {
//         type: ResourceType.BUFFER,
//         name: 'renderBuffer',
//         size: 1024,
//         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
//       }
//     ],
//     canvas: canvasRef.current
//   });

//   useEffect(() => {
//     if (!gpuReady || !canvasRef.current) return;

//     // Create staging buffers for efficient reading
//     const stagingBuffer = device.createBuffer({
//       size: 1024, // Match your render buffer size
//       usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
//     });

//     // Create render context
//     const context = canvasRef.current.getContext('2d');
//     const imageData = context.createImageData(
//       canvasRef.current.width,
//       canvasRef.current.height
//     );

//     const render = async () => {
//       // 1. Run compute shader
//       await dispatch([16, 1, 1]); // Adjust workgroup count as needed

//       // 2. Copy results to staging buffer
//       const commandEncoder = device.createCommandEncoder();
//       commandEncoder.copyBufferToBuffer(
//         buffers.get('renderBuffer'),
//         0,
//         stagingBuffer,
//         0,
//         1024
//       );
//       device.queue.submit([commandEncoder.finish()]);

//       // 3. Read staging buffer and update canvas
//       await stagingBuffer.mapAsync(GPUMapMode.READ);
//       const results = new Float32Array(stagingBuffer.getMappedRange());
      
//       // 4. Update image data
//       // Example: Converting float values to RGBA
//       for (let i = 0; i < results.length; i++) {
//         const value = Math.min(255, Math.max(0, results[i] * 255));
//         const pixelIndex = i * 4;
//         imageData.data[pixelIndex] = value;     // R
//         imageData.data[pixelIndex + 1] = value; // G
//         imageData.data[pixelIndex + 2] = value; // B
//         imageData.data[pixelIndex + 3] = 255;   // A
//       }

//       // 5. Draw to canvas
//       context.putImageData(imageData, 0, 0);
      
//       // 6. Unmap buffer (important!)
//       stagingBuffer.unmap();

//       // 7. Schedule next frame
//       rafId.current = requestAnimationFrame(render);
//     };

//     // Start render loop
//     render();

//     // Cleanup
//     return () => {
//       if (rafId.current) {
//         cancelAnimationFrame(rafId.current);
//       }
//       stagingBuffer.destroy();
//     };
//   }, [gpuReady]);

//   return (
//     <canvas
//       ref={canvasRef}
//       width={512}
//       height={512}
//       className="w-full h-full"
//     />
//   );
// };

// export default RealtimeRenderer;
export {}