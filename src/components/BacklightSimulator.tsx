import { useState, useCallback, useEffect, useRef } from 'react';
import {
  computeBacklightFrame
} from '@/engines/ConvolutionEngine';
import { useWebGPU } from '@/hooks/useWebGPU';
import { GPUBufferUsage } from '@/constants';
import plus1 from '@/shaders/plus1.wgsl';

const videoSrc = require('@/assets/videoplayback.mp4');

const NUM_ELEMENTS = 5324000;
const BUFFER_SIZE_IN_BYTES = NUM_ELEMENTS * 4;
const WORKGROUP_SIZE = 64;

interface Props {
  width: number;
  height: number;
  horizontalDivisions: number;
  verticalDivisions: number;
}

export default function BacklightSimulator(props: Props) {
  const [data, setData] = useState<ImageData>();
  const { width, height, horizontalDivisions, verticalDivisions } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    gpuReady,
    device,
    buffers,
    dispatch,
    createBuffer,
    createBindGroup,
  } = useWebGPU({
    shaderModule: plus1,
    pipelineConfig: { type: 'compute', entryPoint: 'computeMain' },
    resources: [
      {
        type: 'buffer',
        name: 'computeBuffer',
        payload: {
          size: BUFFER_SIZE_IN_BYTES,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        }
      },
      {
        type: 'buffer',
        name: 'stageOutBuffer',
        payload: {
          size: BUFFER_SIZE_IN_BYTES,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        }
      }
    ]
  });

  const sendGpuData = async (frameData: Uint8ClampedArray) => {
    const computeBuffer = buffers.get('computeBuffer');
    const stageOutBuffer = buffers.get('stageOutBuffer');
    
    if(!gpuReady || !device || !computeBuffer || !stageOutBuffer) return;

    const bindGroup = createBindGroup('mainBindGroup',
      {
        entries: [
          { binding: 0, resource: { buffer: computeBuffer } },
        ]
      }
    )!;

    // creating a buffer to constantly feed data     
    console.log('THIS IS HTE FRAME DATA', frameData);
    device.queue.writeBuffer(computeBuffer, 0, frameData, frameData.byteOffset, frameData.byteLength)
    await device.queue.onSubmittedWorkDone();

    // Calculate workgroup count based on buffer size and workgroup size
    const workgroupSize = 64; // Match shader @workgroup_size
    const workgroupCount = Math.ceil(BUFFER_SIZE_IN_BYTES / (4 * workgroupSize)); // 4 bytes per float

    const render = async () => {
      // 1. Run compute shader
      await dispatch([workgroupCount, 1, 1], [bindGroup]); // Adjust workgroup count as needed

      // 2. Copy results to staging buffer
      const commandEncoder = device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(
        computeBuffer,
        0,
        stageOutBuffer,
        0,
        BUFFER_SIZE_IN_BYTES
      );
      device.queue.submit([commandEncoder.finish()]);

      // 3. Read staging buffer and update canvas
      await stageOutBuffer.mapAsync(GPUMapMode.READ);
      const data = stageOutBuffer.getMappedRange().slice(0);
      stageOutBuffer.unmap();
      return new Uint32Array(data);
    }

    console.log('starting GPU code');
    const tick = Date.now();
    const data = await render();
    const tock = Date.now();
    console.log('finished GPU code');
    console.log(data);
    console.log(`it took ${tock - tick}ms`)
    return data;
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
      setData(frame);

      sendGpuData(frame.data).then((val) => console.log(val));
      
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
    [height, width, gpuReady]
  );

  useEffect(
    function setup() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !gpuReady) return;

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
    [handleFrame, height, width, horizontalDivisions, verticalDivisions, gpuReady]
  );

  // NB: if the GPU isn't ready, literally don't start
  if (!gpuReady) return <p>...</p>;
  
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
      {/* <button onClick={() => sendGpuData()}>send gpu data</button> */}
    </div>
  );
}
