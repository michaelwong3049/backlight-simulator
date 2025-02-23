import { useState, useCallback, useEffect, useRef } from 'react';
import { GPUBufferUsage } from '@/constants';
import GPUEngine, { GPUEngineBuffer } from '@/engines/GPUEngine';
import plus1 from '@/shaders/plus1.wgsl';

const videoSrc = require('@/assets/videoplayback.mp4');

const NUM_ELEMENTS = 5324000;
const BUFFER_SIZE_IN_BYTES = NUM_ELEMENTS * 4;
const WORKGROUP_SIZE = 64;

const GPU_BUFFERS: Array<GPUEngineBuffer> = [
  {
    name: 'computeBuffer',
    sizeInBytes: BUFFER_SIZE_IN_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  }
]

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
  const engineRef = useRef<GPUEngine>();
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
        await engine.writeBuffer('computeBuffer', frame.data);
        await engine.execute([64, 1, 1]);
        const data = await engine.readBuffer('computeBuffer');
        const tock = Date.now();
        console.log(`GPU operations took ${tock - tick}ms`);

        // frame.data.set(new Uint8Array(data));
        ctx.putImageData(frame, 0, 0);
        video.requestVideoFrameCallback(() =>
          handleFrame(video, canvas, ctx, horizontalDivisions, verticalDivisions)
        );
      } catch (err) {
        console.error('GPU Error: ', err);
      }
    },
    [height, width]
  );

  useEffect(() => {
    const initGPU = async () => {
      try {
        const engine = new GPUEngine(
          { source: plus1, type: 'compute', computeEntryPoint: 'computeMain' }
        );

        await engine.initialize(GPU_BUFFERS, [['computeBuffer']]);
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
  }, []);

  useEffect(
    function setup() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !isGPUReady) return;
      
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
    [handleFrame, height, width, horizontalDivisions, verticalDivisions, isGPUReady]
  );

  // NB: if the GPU isn't ready, literally don't start
  if (!isGPUReady) return <p>Initializing GPU...</p>;
  
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
