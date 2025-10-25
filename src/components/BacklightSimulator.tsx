import { useState, useCallback, useEffect, useRef } from 'react';
import { GPUBufferUsage } from '@/constants';
import GPUEngine, { GPUEngineBuffer } from '@/engines/GPUEngine';
import convolutionShader from '@/shaders/ConvolutionShader.wgsl';

const videoSrc = require('@/assets/videoplayback.mp4');

const NUM_ELEMENTS = 5324000;
const BUFFER_SIZE_IN_BYTES = NUM_ELEMENTS * 4;
const WORKGROUP_SIZE = 64;

const GPU_BUFFERS: Array<GPUEngineBuffer> = [
  {
    name: 'computeBuffer',
    sizeInBytes: BUFFER_SIZE_IN_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  },
  {
    name: 'paramBuffer',
    // TODO(michaelwong): fix to match the size in bytes of params
    sizeInBytes: 24, 
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

      // ctx.clearRect(0, 0, width, height);
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

        const packedFrameData = new Uint32Array(frame.data.buffer);
        await engine.writeBuffer('computeBuffer', packedFrameData);

        const shaderTick = Date.now();
        await engine.execute([horizontalDivisions, verticalDivisions, 1]);
        // 64 threads per workgroup * 64 workgroups * 720 * 640
        const shaderTock = Date.now();
        console.log(`Spent ${shaderTock - shaderTick}ms on the GPU shader`)

        const data = await engine.readBuffer('computeBuffer');
        const params = await engine.readBuffer("paramBuffer");
        const divisionBuffer = await engine.readBuffer('divisionBuffer');

        // console.log(new Uint8Array(divisionBuffer));

        const tock = Date.now();
        console.log(`GPU operations took ${tock - tick}ms`);

        const divisionData = new Uint32Array(divisionBuffer);

        console.log(divisionData);
        const fourth = divisionData[4];
        const fourthRed = fourth & 255;
        const fourthGreen = (fourth >> 8) & 255;
        const fourthBlue = (fourth >> 16) & 255;
        const fourthAlpha = (fourth >> 24) & 255;

        const newArray = new Uint8ClampedArray(frame.data.length);

        for (let i = 0; i < frame.data.length; i += 4) {
          newArray[i] = fourthRed;
          newArray[i + 1] = fourthBlue;
          newArray[i + 2] = fourthGreen;
          newArray[i + 3] = fourthAlpha;
        }

        // for (let i = 0; i < newArray.length; i += 5) {
        //   const row = divisionData[i]
        //   const col = divisionData[i + 1]
        //   const width = divisionData[i + 2]
        //   const height = divisionData[i + 3]
        //   const color = divisionData[i + 4]
        //
        //   const red = color & 255;
        //   const blue = (color >> 8) & 255;
        //   const green = (color >> 16) & 255;
        //   const alpha = (color >> 24) & 255;
        //
        //   // iterate through this row to populate
        //   for (let r = row; r < row + height; r++) {
        //     for (let c = col; c < col + width; c++) {
        //       let pixelIdx = (r * frame.width + c);
        //
        //       newArray[pixelIdx] = red;
        //       newArray[pixelIdx + 1] = blue;
        //       newArray[pixelIdx + 2] = green;
        //       newArray[pixelIdx + 3] = alpha;
        //     }
        //   }
        // }
    
        const newFrame = new ImageData(newArray, width, height)
        
        // frame.data.set(newFrame);
        ctx.putImageData(newFrame, 0, 0);

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
          { source: convolutionShader, type: 'compute', computeEntryPoint: 'computeMain' }
        );

        await engine.initialize(GPU_BUFFERS, [['computeBuffer', 'paramBuffer']]);
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
      const engine = engineRef.current;
      if (!video || !canvas || !isGPUReady || !engine) return;
      
      // NOTE: we can disable alpha channel here which should save comp time
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      
      const startFrameProcessing = async () => {
        const params = new Uint32Array([
          horizontalDivisions,
          verticalDivisions,
          video.offsetHeight,
          video.offsetWidth,
          canvas.width,
          canvas.height
        ]);
        await engine.writeBuffer('paramBuffer', params);

        if (!engine.hasBuffer('divisionBuffer')) {
          engine.createBuffer({
            name: 'divisionBuffer',
            // each division has 5 numbers, each 4 bytes
            // we have horiztonal * vertical divisions.
            sizeInBytes: horizontalDivisions * verticalDivisions * 5 * 4, // 180
            // maybe this usage is too much
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
          }, 0);
        }

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
