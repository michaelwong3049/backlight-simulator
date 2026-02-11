import { expect } from '@esm-bundle/chai';

import GPUEngine, { GPUEngineBuffer } from "@/engines/GPUEngine"; // "src/engines/GPUEngine"
// import convolutionShader from '@/shaders/ConvolutionShader.wgsl';

import { GPU_BUFFERS } from "../../../src/constants";


describe("GPUEngine", () => {

  // 1. initilaize the GPU 
  // 2. create the acutal frontend that we wanna test against
  // 3. test against resource initialization
  // 4. once all pass, we can test for computational functions
  // 4. then we can return whether or not its right

  // should i replicate @BacklightSimulator.tsx where we add buffers and have this computeBindGroups array?

  let engine: GPUEngine | null;

  const engineTestBuffers: Array<GPUEngineBuffer> = [
    {
      name: "test_buffer_1",
      label: "test_buffer_1 - label",
      sizeInBytes: 24,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
    } ,
    {
      name: "test_buffer_2",
      label: "test_buffer_2 - label",
      sizeInBytes: 16,
      usage: GPUBufferUsage.STORAGE
    } ,
    {
      name: "test_buffer_3",
      label: "test_buffer_3 - label",
      sizeInBytes: 32,
      usage: GPUBufferUsage.COPY_DST
    } 
  ]


    const engineTestComputeBindGroups = [
      {
        name: 'test_compute_bind_groups_1',
        visibility: GPUShaderStage.COMPUTE,
        buffers: ['test_buffer_1', 'test_buffer_2']
      },
      {
        name: 'test_compute_bind_group_1',
        visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
        buffers: ['test_buffer_3']
      }
    ]

  const textureBindGroups = [
    {
      name: 'test_texture_bind_group_1',
      visibility: GPUShaderStage.FRAGMENT,
      buffers: ['videoOutputTexture'] 
    }
  ]

  afterEach(() => {
    expect(engine).to.not.be.null;
    engine!.cleanup();
  })

  it("creates buffers", () => {
    expect(engine).to.not.be.null;

    engine!.createBuffers(engineTestBuffers);

    engineTestBuffers.forEach((buffer) => {
      expect(engine!.hasBuffer(buffer.name));
    })
  })
})

describe("shader computations", () => {

  let engine: GPUEngine | null;
  let video: HTMLVideoElement | null;
  let testFrame: ImageData | null;
  let canvas: HTMLCanvasElement | null; 
  let ctx: GPUCanvasContext | null;

  const computeTestBindGroups = [
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

  const textureTestBindGroups = [
    {
      // this bind group holds the buffers of the input data of the video's per frame image data and processing output
      name: 'textureDataBindGroup',
      visibility: GPUShaderStage.FRAGMENT,
      buffers: ['videoOutputTexture'] 
    }
  ]


  beforeEach(async  () => {
    try {
      engine = await GPUEngine.initialize(1920, 1080, GPU_BUFFERS);

      engine.createBuffers([{
        name: 'colorDivisionOutBuffer',
        label: 'colorDivisionOutBuffer - label',
        // each division has 5 numbers, each 4 bytes
        // 3 and 3 represents # of divisions
        sizeInBytes: 3 * 3 * 5 * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
      }]);

      engine.createPipeline(
        {
          convolution: { 
            source: convolutionShader,
            type: 'compute',
            bindGroups: computeTestBindGroups
          },
          videoMapper: { 
            source: convolutionShader,
            type: 'render',
            bindGroups: textureTestBindGroups
          },
        },
      )

      canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;

      ctx = canvas.getContext("webgpu");
      engine.initializeCanvas(canvas);

      document.body.appendChild(canvas);
    } catch (error) {
      throw new Error("Error initiallizing GPUEngine: " + error);
    }
  })

  afterEach(() => {
    expect(engine).to.not.be.null;

    engine?.cleanup();
  })

  it("averages colors for each division", async () => {
    expect(engine).to.not.be.null;
    expect(testFrame).to.not.be.null;
    expect(ctx).to.not.be.null;
  })
})
