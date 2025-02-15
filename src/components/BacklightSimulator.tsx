import { useCallback, useEffect, useRef } from 'react';
import {
  computeBacklightFrame
} from '@/engines/ConvolutionEngine';
import { useWebGPU } from '@/hooks/useWebGPU';
import { GPUBufferUsage } from '@/constants';

const videoSrc = require('@/assets/videoplayback.mp4');

const BUFFER_SIZE_IN_BYTES = 268435456;
const MAX_ELEMENTS = BUFFER_SIZE_IN_BYTES / 4;
const WORKGROUP_SIZE = 64;

console.log(MAX_ELEMENTS);

interface Props {
  width: number;
  height: number;
  horizontalDivisions: number;
  verticalDivisions: number;
}

export default function BacklightSimulator(props: Props) {
  const { width, height, horizontalDivisions, verticalDivisions } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    gpuReady,
    device,
    buffers,
    dispatch,
    createBuffer,
    createBindGroup
  } = useWebGPU({
    shaderModule: `
      @group(0) @binding(0) var<storage, read_write> computeBuffer: array<f32>;

      @compute @workgroup_size(${WORKGROUP_SIZE})
      fn computeMain(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let idx = global_id.x;
        if (idx >= arrayLength(&computeBuffer)) {
          return;
        }
        // Your computation here
        computeBuffer[idx] = 888;
      }
    `,
    pipelineConfig: {
      type: 'compute',
      entryPoint: 'computeMain'
    },
    resources: [
      {
        type: 'buffer',
        name: 'computeBuffer',
        payload: {
          size: BUFFER_SIZE_IN_BYTES,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        }
      },
    ],
    canvas: canvasRef.current
  });

  const sendGpuData = async () => {
    if(!gpuReady || !device) return;

    const bindGroup = createBindGroup('mainBindGroup',
      {
        entries: [
          { binding: 0, resource: { buffer: buffers.get('computeBuffer')! } },
        ]
      }
    )!;

    const stagingBuffer = device.createBuffer({
      size: BUFFER_SIZE_IN_BYTES, // Match your render buffer size
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    // Calculate workgroup count based on buffer size and workgroup size
    const workgroupSize = 64; // Match shader @workgroup_size
    const workgroupCount = Math.ceil(BUFFER_SIZE_IN_BYTES / (4 * workgroupSize)); // 4 bytes per float

    const render = async () => {
      // 1. Run compute shader
      await dispatch([workgroupCount, 1, 1], [bindGroup]); // Adjust workgroup count as needed

      // 2. Copy results to staging buffer
      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(
        buffers.get('computeBuffer')!,
        0,
        stagingBuffer,
        0,
        BUFFER_SIZE_IN_BYTES
      );
      device.queue.submit([commandEncoder.finish()]);

      // 3. Read staging buffer and update canvas
      await stagingBuffer.mapAsync(GPUMapMode.READ);
      const results = new Float32Array(stagingBuffer.getMappedRange());
      const resultsCopy = results.slice();
      stagingBuffer.unmap();

      return resultsCopy;
    }

    console.log('starting GPU code');
    const tick = Date.now();
    const data = await render();
    const tock = Date.now();
    console.log('finished GPU code');
    console.log(data);
    console.log(`it took ${tock - tick}ms`)
  }

  const handleFrame = useCallback(
    (
      video: HTMLVideoElement,
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      horizontalDivisions: number,
      verticalDivisions: number
    ) => {
      if (video.paused) return;

      ctx.clearRect(0, 0, width, height);
      // TODO: if we're only calculating divisions, we may not need to draw the whole image...
      // TODO: we could even potentially use an offscreen canvas to save on render times
      ctx.drawImage(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight,
        0,
        0,
        width,
        height
      );

      const frame = ctx.getImageData(0, 0, width, height);
      const backlightFrame = computeBacklightFrame(
        ctx,
        frame,
        { width: video.offsetWidth, height: video.offsetHeight },
        {
          horizontalDivisions,
          verticalDivisions,
        }
      );
      ctx.putImageData(backlightFrame, 0, 0);

      video.requestVideoFrameCallback(() =>
        handleFrame(video, canvas, ctx, horizontalDivisions, verticalDivisions)
      );
    },
    [height, width]
  );

  useEffect(
    function setup() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      // NOTE: we can disable alpha channel here which should save comp time
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const startFrameProcessing = () =>
        video.requestVideoFrameCallback(() =>
          handleFrame(
            video,
            canvas,
            ctx,
            horizontalDivisions,
            verticalDivisions
          )
        );
      video.addEventListener('play', startFrameProcessing);

      const handleResize = () => {
        canvas.width = width;
        canvas.height = height;
      };
      window.addEventListener('resize', handleResize);
      handleResize();

      return () => {
        video.removeEventListener('play', startFrameProcessing);
        window.removeEventListener('resize', handleResize);
      };
    },
    [handleFrame, height, width, horizontalDivisions, verticalDivisions]
  );

  // TODO: we can move these styles into css later
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <canvas ref={canvasRef} width={width} height={height}></canvas>
      <video ref={videoRef} id='video' src={videoSrc} muted loop controls />
      <button onClick={sendGpuData}>send gpu data</button>
    </div>
  );
}
