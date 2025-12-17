import { useState, useCallback, useEffect, useRef } from 'react';
import { GPUBufferUsage } from '@/constants';
import GPUEngine, { GPUEngineBuffer } from '@/engines/GPUEngine';
import backlightShader from '@/shaders/backlight.wgsl';
import convolutionShader from '@/shaders/ConvolutionShader.wgsl';

const videoSrc = require('@/assets/videoplayback.mp4');

const NUM_ELEMENTS = 5324000; // TODO(andymina): where did this number come from?
const BUFFER_SIZE_IN_BYTES = NUM_ELEMENTS * 4;
const WORKGROUP_SIZE = 64;

// TODO(michaelwong): figure out how to parameterize the render pass descriptor

const GPU_BUFFERS: Array<GPUEngineBuffer> = [
  // im unsure if this frameDataBuffer should be here sine we arent using a buffer for sending video imagedata anymore... we are using a texture
  // {
  //   name: 'frameDataBuffer', // this buffer is for the video's pixel color image data
  //   sizeInBytes: BUFFER_SIZE_IN_BYTES,
  //   // sizeInBytes: BUFFER_SIZE_IN_BYTES,
  //   // usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
  //   usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
  // },
  {
    name: 'settingsBuffer', // TODO: this buffer is for ...
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

      // put video into texture 
      // const texture = engine.device?.importExternalTexture({ source: })

      // ctx.clearRect(0, 0, width, height);
      // if we're only calculating divisions, we may not need to draw the whole image...
      // we could even potentially use an offscreen canvas to save on render times
      // ctx.drawImage(
      //   video,
      //   0,
      //   0,
      //   video.videoWidth,
      //   video.videoHeight,
      //   0,
      //   0,
      //   width,
      //   height
      // );
      
      try {
        const shaderTick = Date.now();
        await engine.execute(video, ctx, [horizontalDivisions, verticalDivisions, 1]);

        // NOTE: maybe we can use beginRenderPass(...) to draw to the canvas (we might save time instead of having to map result to new frame)

        // link the GPU's texture to the canvas context

        const shaderTock = Date.now();

        // const data = await engine.readBuffer("colorDivisionOutBuffer");
        // console.log(new Uint8Array(data))

        video.requestVideoFrameCallback(() =>
          handleFrame(video, canvas, ctx, horizontalDivisions, verticalDivisions)
        );
      } catch (error) {
        console.error("something went wrong here...", error)
      }

      // const frame = ctx.getImageData(0, 0, width, height);
      // try {
      //   const tick = Date.now();
      
      //   const packedFrameData = new Uint32Array(frame.data.buffer);
      //   await engine.writeBuffer('computeBuffer', packedFrameData);
      
      //   const shaderTick = Date.now();
      //   await engine.execute([horizontalDivisions, verticalDivisions, 1]);
      //   // 64 threads per workgroup * 64 workgroups * 720 * 640
      //   const shaderTock = Date.now();
      //   console.log(`Spent ${shaderTock - shaderTick}ms on the GPU shader`)
      
      //   const data = await engine.readBuffer('computeBuffer');
      //   const params = await engine.readBuffer("paramBuffer");
      //   const divisionBuffer = await engine.readBuffer('divisionBuffer');
      
      //   // console.log(new Uint8Array(divisionBuffer));
      
      //   const tock = Date.now();
      //   console.log(`GPU operations took ${tock - tick}ms`);
      
      //   const divisionData = new Uint32Array(divisionBuffer);
      
      //   console.log(divisionData);
      //   const fourth = divisionData[4];
      //   const fourthRed = fourth & 255;
      //   const fourthGreen = (fourth >> 8) & 255;
      //   const fourthBlue = (fourth >> 16) & 255;
      //   const fourthAlpha = (fourth >> 24) & 255;
      
      //   const newArray = new Uint8ClampedArray(frame.data.length);
      
      //   for (let i = 0; i < frame.data.length; i += 4) {
      //     newArray[i] = fourthRed;
      //     newArray[i + 1] = fourthBlue;
      //     newArray[i + 2] = fourthGreen;
      //     newArray[i + 3] = fourthAlpha;
      //   }
      
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
      
        // const newFrame = new ImageData(newArray, width, height)
      
        // frame.data.set(newFrame);
        // ctx.putImageData(newFrame, 0, 0);
      
        video.requestVideoFrameCallback(() =>
          handleFrame(video, canvas, ctx, horizontalDivisions, verticalDivisions)
        );
      // } catch (err) {
      //   console.error('GPU Error: ', err);
      // }
    },
    [height, width]
  );

  useEffect(() => {
    (async () => {
      const engine = await GPUEngine.initialize(
        // {
        //   convolution: { type: 'compute', source: convolutionShader },
        //   videoMapper: { type: 'render', source: backlightShader },
        // },
        1920, // im filling in this with my own data, unsure how i can get video for now
        1080,
        GPU_BUFFERS
      );
      engineRef.current = engine;

      // TODO(michaelwong): Initialize my known buffers
      // engine.createBuffers(GPU_BUFFERS)

      setIsGPUReady(true);
    })();

    // const initGPU = async () => {
    //   const engine = await GPUEngine.initialize();
    //   engineRef.current = engine;
    //   setIsGPUReady(true);
    //   const engine = new GPUEngine(
    //     { source: convolutionShader, type: 'compute', computeEntryPoint: 'computeMain' }
    //   );

    //   const engine = new GPUEngine({ 
    //     source: backlightShader, 
    //     type: 'render', 
    //     vertexEntryPoint: 'vertexMain', 
    //     fragmentEntryPoint: 'fragmentMain'
    //   });

    //   await engine.initialize(GPU_BUFFERS, [['computeBuffer', 'paramBuffer']]);
    // };

    // initGPU();

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

      const ctx = canvas.getContext('webgpu'); // TODO: maybe we can use willReadFrequently
      if (!ctx) return;

      // TODO: make it so that we call this only when video dimensions change (do they even change?)
      engine.updateTexture(1920, 1080);

      // Initialize the canvas for speedy GPU rendering
      engine.initializeCanvas(canvas);

      // Initialize my runtime buffers
      if (!engine.hasBuffer('colorDivisionOutBuffer')) {
        engine.destroyBuffer('colorDivisionOutBuffer');
      }
      engine.createBuffers([{
        name: 'colorDivisionOutBuffer',
        // each division has 5 numbers, each 4 bytes
        // we have horiztonal * vertical divisions.
        sizeInBytes: horizontalDivisions * verticalDivisions * 5 * 4, // 180
        // TODO(andymina): maybe this usage is too much
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
      }]);

      // Assign bind groups to my buffers
      // engine.createBindGroups([
      //   [  // group 0
      //     { name: 'settingsBuffer', visibility: GPUShaderStage.COMPUTE }
      //   ],
      //   [ // group 1
      //     { name: 'frameDataBuffer', visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE }, 
      //     { name: 'colorDivisionOutBuffer', visibility: GPUShaderStage.FRAGMENT }
      //   ]
      // ]);

      // engine.createBindGroups([
      //   {
      //     // bind group and buffer holds the data about our parameters for computations (horizontalDivision, videoWidth, etc)
      //     name: 'settingsBindGroup',
      //     visibility: GPUShaderStage.COMPUTE,
      //     buffers: ['settingsBuffer']
      //   },
      //   {
      //     // this bind group holds the buffers of the input data of the video's per frame image data and processing output
      //     name: 'dataBindGroup',
      //     visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
      //     buffers: ['videoImageData', 'colorDivisionOutBuffer']
      //   }
      // ]);

      const bindGroups = [
        {
          // bind group and buffer holds the data about our parameters for computations (horizontalDivision, videoWidth, etc)
          name: 'settingsBindGroup',
          visibility: GPUShaderStage.COMPUTE,
          buffers: ['settingsBuffer']
        },
        {
          // this bind group holds the buffers of the input data of the video's per frame image data and processing output
          name: 'dataBindGroup',
          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
          buffers: ['videoImageData', 'colorDivisionOutBuffer']
        }
      ];

      engine.createPipeline(
        {
          convolution: { 
            type: 'compute',
            source: convolutionShader,
            bindGroups
          },
          videoMapper: { 
            type: 'render',
            source: backlightShader,
            bindGroups
          },
        },

      )

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
            ctx, //  - not needed? sending video frame data directly via texture 
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
