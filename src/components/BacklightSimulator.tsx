import { useState, useCallback, useEffect, useRef } from 'react';
import { GPUBufferUsage } from '@/constants';
import GPUEngine, { GPUEngineBuffer } from '@/engines/GPUEngine';
import backlightShader from '@/shaders/backlight.wgsl';
import convolutionShader from '@/shaders/ConvolutionShader.wgsl';

const videoSrc = require('@/assets/videoplayback.mp4');

const NUM_ELEMENTS = 5324000; // TODO(andymina): where did this number come from?
const BUFFER_SIZE_IN_BYTES = NUM_ELEMENTS * 4;
const WORKGROUP_SIZE = 64;

const GPU_BUFFERS: Array<GPUEngineBuffer> = [
  {
    name: 'settingsBuffer', // TODO: this buffer is for ...
    label: "settingsBuffer - label",
    // TODO(michaelwong): fix to match the size in bytes of params
    sizeInBytes: 24, 
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
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
      ctx: GPUCanvasContext,
      horizontalDivisions: number,
      verticalDivisions: number
    ) => {
      const engine = engineRef.current;
      if (video.paused || !engine) return;
      if (engine.isProcessing()) {
        console.log('dropping frame since GPU is falling behind');
        return;
      }
      
      try {
        // Profile shader execution
        const shaderTick = Date.now();
        await engine.execute(video, ctx, [horizontalDivisions, verticalDivisions, 1]);
        const shaderTock = Date.now();

        // Move onto processing the next frame
        video.requestVideoFrameCallback(() =>
          handleFrame(video, canvas, ctx, horizontalDivisions, verticalDivisions)
        );
      } catch (error) {
        console.error("FAILURE: could not process frame", error)
      }
    },
    [height, width]
  );

  useEffect(() => {
    (async () => {
      const engine = await GPUEngine.initialize(
        // TODO: replace these two numbers with the width and height of viewport
        1920, 
        1080,
        GPU_BUFFERS
      );
      engineRef.current = engine;

      setIsGPUReady(true);
    })();

    /**
     * michael loads the page
     *  the BacklightSimulator.tsx component is *mounted*
     *  the BS is rendered
     *  the no-dep useEffect is run
     *    GPU engine is initialized
     *    the no-dep useEffect register its cleanup function (cleanupNoDep)
     *  the many-dep useEffect is run
     *    GPU resources are initialized
     *      if colorDivisionOutBuffer is not created, create it
     *    the many-dep useEffect registers its cleanup function (cleanupManyDep)
     *  the page finishes loading
     * 
     * michael clicks the update division button
     *  button has onclick to update state in parent component
     *  parent componet updates state internally
     *  parent component passes new values to children that use them as props
     *  BS sees # of divisions of changes, decides it needs to go from render #1 -> render #2
     *  BS render #1 runs cleanupNoDep
     *    calls engine.cleanup()
     *      deletes any buffers declared in GPUEngine.buffers
     *  BS render #2 run cleanupManyDep
     *    calls engine.cleanup()
     *      deletes any buffers declared in GPUEngine.buffers
     *  BS render #2 is ready
     *  the no-dep useEffect is NOT run (the component is still mounted!!)
     *  the many-dep useEffect IS run (the values in the deps have changed)
     *    GPU resources are initialized
     *      if colorDivisionOutBuffer is not created, create it
     *    the many-dep useEffect registers its cleanup function (cleanupManyDep)
     */

    // return () => {
    //   if (engineRef.current) engineRef.current.cleanup()
    // };
  }, []);

  useEffect(
    function setup() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const engine = engineRef.current;
      if (!video || !canvas || !isGPUReady || !engine) return;

      const ctx = canvas.getContext('webgpu');
      if (!ctx) return;

      // TODO: make it so that we call this only when video dimensions change
      // engine.updateTexture(1920, 1080);

      engine.initializeCanvas(canvas);

      // Use IIFE to handle async buffer destruction/creation
      (async () => {
        // Wait for any in-flight GPU work to complete before destroying buffers
        await engine.device.queue.onSubmittedWorkDone();

        // Initialize my runtime buffers
        if (engine.hasBuffer('colorDivisionOutBuffer')) {
          engine.destroyBuffer('colorDivisionOutBuffer');
        }

        engine.createBuffers([{
          name: 'colorDivisionOutBuffer',
          label: 'colorDivisionOutBuffer - label',
          // each division has 5 numbers, each 4 bytes
          // we have horiztonal * vertical divisions.
          sizeInBytes: horizontalDivisions * verticalDivisions * 5 * 4, // 180
          // TODO(andymina): maybe this usage is too much
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        }]);

        const computeBindGroups = [
          {
            // bind group and buffer holds the data about our parameters for computations (horizontalDivision, videoWidth, etc)
            name: 'settingsBindGroup',
            visibility: GPUShaderStage.COMPUTE,
            buffers: ['settingsBuffer', 'colorDivisionOutBuffer']
          },
          {
            // this bind group holds the buffers of the input data of the video's per frame image data and processing output
            name: 'dataBindGroup',
            visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
            buffers: ['videoInputTexture', 'videoOutputTexture']
          }
        ]

        const textureBindGroups = [
          {
            // this bind group holds the buffers of the input data of the video's per frame image data and processing output
            name: 'textureDataBindGroup',
            visibility: GPUShaderStage.FRAGMENT,
            buffers: ['videoOutputTexture'] 
          }
        ]

        engine.createPipeline(
          {
            convolution: { 
              source: convolutionShader,
              type: 'compute',
              bindGroups: computeBindGroups
            },
            videoMapper: { 
              source: convolutionShader,
              type: 'render',
              bindGroups: textureBindGroups
            },
          },
        )
      })();

      const startFrameProcessing = async () => {
        const params = new Uint32Array([
          horizontalDivisions,
          verticalDivisions,
          video.offsetHeight,
          video.offsetWidth,
          canvas.width,
          canvas.height
        ]);
        await engine.writeBuffer('settingsBuffer', params);

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

      return function cleanup() {
        video.removeEventListener('play', startFrameProcessing);
        window.removeEventListener('resize', handleResize);
        // TODO(andymina): we need to properly clean up GPU resources
        // engine.cleanup();
      };
    },
    [handleFrame, height, width, horizontalDivisions, verticalDivisions, isGPUReady]
  );

  if (!isGPUReady)
    return <p>Initializing GPU...</p>;
  
  return (
    <div
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <canvas ref={canvasRef} width={width} height={height}></canvas>
      <video ref={videoRef} id='video' src={videoSrc} muted loop controls />
    </div>
  );
}
