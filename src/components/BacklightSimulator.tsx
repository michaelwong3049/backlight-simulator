import { useState, useCallback, useEffect, useRef } from 'react';
import { GPUBufferUsage } from '@/constants';
import GPUEngine, { GPUEngineBuffer } from '@/engines/GPUEngine';
import type { Dimensions } from '@/types';
import computeDivisions from '@/shaders/computeDivisions.wgsl';

const videoSrc = require('@/assets/videoplayback.mp4');

const buildGPUResourceDescriptions = (
  horizontalDivisions: number,
  verticalDivisions: number,
  videoDimensions: Dimensions,
  canvasDimensions: Dimensions,
): { buffers: Array<GPUEngineBuffer>, bindGroups: Array<Array<string>> } => {
  const frameDataBufferSize = canvasDimensions.width * canvasDimensions.height * 4;

  return {
    buffers: [
      {
        name: 'parameters',
        sizeInBytes: 6 * 4, // 6 f32 numbers @ 4 bytes each
        usage: GPUBufferUsage.UNIFORM,
        data: new Float32Array([
          horizontalDivisions,
          verticalDivisions,
          videoDimensions.width,
          videoDimensions.height,
          canvasDimensions.width,
          canvasDimensions.height,
        ])
      },
      {
        name: 'divisions',
        // each division has 5 numbers, each 4 bytes
        // we have horiztonal * vertical divisions.
        sizeInBytes: horizontalDivisions * verticalDivisions * 5 * 4,
        usage: GPUBufferUsage.STORAGE
      },
      {
        name: 'inputFrameData',
        sizeInBytes: frameDataBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      },
      {
        name: 'outputFrameData',
        sizeInBytes: frameDataBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
      },
      {
        name: 'upload',
        sizeInBytes: frameDataBufferSize,
        usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC
      },
      {
        name: 'download',
        sizeInBytes: frameDataBufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      }
    ],
    bindGroups: [
      ['parameters'],
      // computeDivisions.wgsl
      ['inputFrameData', 'divisions'],
      // regionConvolution.wgsl
      ['divisions', 'inputFrameData', 'outputFrameData']
    ]
  };
}

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
  const engineRef = useRef<GPUEngine>(new GPUEngine({ source: computeDivisions, type: 'compute', computeEntryPoint: 'main' }));
  const [isGPUReady, setIsGPUReady] = useState(false);

  const handleFrame = useCallback(
    async (
      video: HTMLVideoElement,
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      horizontalDivisions: number,
      verticalDivisions: number
    ) => {
      const engine = engineRef.current;
      if (video.paused || !engine) return;
      if (engine.isProcessing()) {
        console.log('dropping frame since GPU is falling behind');
        return;
      }


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
      try {
        const tick = Date.now();
        console.log(engine.hasBuffer('inputFrameData'));
        // await engine.writeBuffer('inputFrameData', frame.data);
        // one workgroup per division
        await engine.execute([horizontalDivisions, verticalDivisions, 1]);
        const tock = Date.now();

        console.log(`GPU operations took ${tock - tick}ms`);

        video.requestVideoFrameCallback(() =>
          handleFrame(video, canvas, ctx, horizontalDivisions, verticalDivisions)
        );
      } catch (err) {
        console.error('GPU Error: ', err);
      }
    },
    [height, width]
  );

  useEffect(
    function setup() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      if (!video || !canvas || !isGPUReady || !engine) return;
      
      // NOTE: we can disable alpha channel here which should save comp time
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      
      const startFrameProcessing = () => {
        video.requestVideoFrameCallback(() =>
          handleFrame(
            video,
            canvas,
            ctx,
            horizontalDivisions,
            verticalDivisions
          )
        );
      };
      video.addEventListener('play', startFrameProcessing);
      
      const handleResize = () => {
        canvas.width = width;
        canvas.height = height;
        engine.cleanup();
      };
      window.addEventListener('resize', handleResize);
      handleResize();

      return () => {
        video.removeEventListener('play', startFrameProcessing);
        window.removeEventListener('resize', handleResize);
        engine.cleanup();
      };
    },
    [handleFrame, height, width, horizontalDivisions, verticalDivisions, isGPUReady]
  );

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      console.log('vc not ready');
      return;
    }

    const engine = engineRef.current;
    if (!engine) {
      console.error('GPUEngine is not defined');
      return;
    }

    const initGPU = async () => {
      try {
        const videoDimensions: Dimensions = { width: video.offsetWidth, height: video.offsetHeight };
        const canvasDimensions: Dimensions = { width: canvas.width, height: canvas.height };
        const { buffers, bindGroups } = buildGPUResourceDescriptions(
          horizontalDivisions,
          verticalDivisions,
          videoDimensions,
          canvasDimensions
        );

        await engine.initialize(buffers, bindGroups);
        engineRef.current = engine;
        setIsGPUReady(true);
      } catch (err) {
        console.error('BIG ERROR', err);
        setIsGPUReady(false);
      }
    };

    initGPU();

    // Cleanup function
    return () => {
      if (engineRef.current) engineRef.current.cleanup()
    };
  }, [horizontalDivisions, verticalDivisions]);
  
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
