import { expect as chaiExcept } from 'chai';

import { spy } from 'sinon';

import GPUEngine, { GPUEngineBuffer } from "@/engines/GPUEngine";
import convolutionShader from '@/shaders/ConvolutionShader.wgsl';

import { GPU_BUFFERS } from '@/constants';

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
    name: 'test_compute_bind_groups_2',
    visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
    buffers: ['test_buffer_3']
  }
]

const textureBindGroups = [
  {
    name: 'test_texture_bind_groups_1',
    visibility: GPUShaderStage.FRAGMENT,
    buffers: ['videoOutputTexture'] 
  }
]


describe("GPUEngine", () => {

  // 1. initilaize the GPU 
  // 2. create the acutal frontend that we wanna test against
  // 3. test against resource initialization
  // 4. once all pass, we can test for computational functions
  // 4. then we can return whether or not its right

  // should i replicate @BacklightSimulator.tsx where we add buffers and have this computeBindGroups array?

  let engine: GPUEngine | null;

  beforeEach(async () => {
    try {
      engine = await GPUEngine.initialize(
        1920, 
        1080,
        GPU_BUFFERS
      );
    } catch (error) {
      throw new Error(`Error initializing GPU: + ${error}`);
    }
  })

  afterEach(() => {
    chaiExcept(engine).to.not.be.null;
    engine!.cleanup();
  })

  describe("GPUEngine's createBuffers function", () => {
    it('creates the buffers on the GPU', () => {
      chaiExcept(engine).to.not.be.null;

      const createBufferSpy = spy(engine!.device, 'createBuffer');

      engine!.createBuffers([{
        name: 'myTestBuffer',
        sizeInBytes: 32,
        label: 'myTestBuffer - label', 
        usage: GPUBufferUsage.STORAGE,
      }]);

      chaiExcept(createBufferSpy.calledOnce).to.be.true;
      chaiExcept(engine!.hasBuffer('myTestBuffer')).to.be.true;
    });
  });

  describe("GPUEngine's createPipeline function testing for bind group creation", () => {
    it("creates bind groups for the GPU", () => {
      chaiExcept(engine).to.not.be.null;

      const createBindGroupLayoutSpy = spy(engine!.device, "createBindGroupLayout");
      const createBindGroupSpy = spy(engine!.device, "createBindGroup");

      engine!.createBuffers(engineTestBuffers);

      // we call this createPipeline function, but we test against bind group initialization functionality for now
      engine!.createPipeline(
        {
          computations: {
            source: convolutionShader,
            type: "compute",
            bindGroups: engineTestComputeBindGroups
          },
          display: {
            source: convolutionShader,
            type: "render",
            bindGroups: textureBindGroups
          }
        }
      )

      chaiExcept(createBindGroupLayoutSpy.callCount).to.equal(3);
      chaiExcept(createBindGroupSpy.callCount).to.equal(3);

      for (let idx = 0; idx < 2; idx++) {
        const bindGroupLayoutCall = createBindGroupLayoutSpy.getCall(idx);
        const bindGroupLayoutCallArgs = bindGroupLayoutCall.args[0];

        const layout = bindGroupLayoutCall.returnValue;
        const layoutLabel = bindGroupLayoutCallArgs.label;
        const layoutEntries = Array.from(bindGroupLayoutCallArgs.entries); // Q(andymina): required because our tsconfig doesnt allow iteration on an Iterable type??

        const bindGroupCall = createBindGroupSpy.getCall(idx);
        const bindGroupCallArgs = bindGroupCall.args[0];

        const bindGroupLabel = bindGroupCallArgs.label;
        const bindGroupLayout = bindGroupCallArgs.layout;
        const bindGroupEntries = Array.from(bindGroupCallArgs.entries);

        // since bind groups are created with bind group layouts, we test bind group layouts first... we have to test label, and entries
        if (idx == 0) chaiExcept(layoutLabel).to.equal("test_compute_bind_groups_1 - layout");
        else if (idx == 1) chaiExcept(layoutLabel).to.equal("test_compute_bind_groups_2 - layout");
        else if (idx == 2) chaiExcept(layoutLabel).to.equal("test_texture_bind_groups_1 - layout");

        // this is testing for the computeBindGroups
        for (const entry of layoutEntries) {
          // here we are dealing with a bind group with only buffers...
          chaiExcept(entry.buffer).to.not.be.undefined;
          chaiExcept(entry.texture).to.be.undefined;
        }

        // now we test the bind group itself... we have to test the label, layout, and entries
        if (idx == 0) chaiExcept(bindGroupLabel).to.equal("test_compute_bind_groups_1 - bind group");
        else if (idx == 1) chaiExcept(bindGroupLabel).to.equal("test_compute_bind_groups_2 - bind group");
        else if (idx == 2) chaiExcept(bindGroupLabel).to.equal("test_texture_bind_groups_1 - bind group");
        chaiExcept(bindGroupLayout).to.equal(layout); // i think equal here is right and not deep equal?
        for (const entry of bindGroupEntries) {
          // first we need chaiExcept that the property exists, so then we can take it 
          if ("buffer" in entry.resource) {
            chaiExcept(entry.resource["buffer"]).to.be.instanceOf(GPUBuffer)
          } else {
            chaiExcept(entry.resource).to.be.instanceOf(GPUTextureView);
          }
        }
      }
    })
  })

  describe("GPUEngine's createPipeline function", () => {
    it("creates the bind groups, layouts, and pipelines for compute/render", () => {
      chaiExcept(engine).to.not.be.null;

      const createPipelineLayoutSpy = spy(engine!.device, "createPipelineLayout");
      const createBindGroupLayoutSpy = spy(engine!.device, "createBindGroupLayout");
      const createComputePipelineSpy = spy(engine!.device, "createComputePipeline");
      const createRenderPipelineSpy = spy(engine!.device, "createRenderPipeline");
      const createShaderModuleSpy = spy(engine!.device, "createShaderModule");
      let bindGroupLayoutIdx = 0;

      engine!.createBuffers(engineTestBuffers);

      engine!.createPipeline(
        {
          computations: {
            source: convolutionShader,
            type: "compute",
            bindGroups: engineTestComputeBindGroups
          },
          display: {
            source: convolutionShader,
            type: "render",
            bindGroups: textureBindGroups
          }
        }
      )

      chaiExcept(createBindGroupLayoutSpy.callCount).to.equal(3);
      chaiExcept(createPipelineLayoutSpy.callCount).to.equal(2);
      chaiExcept(createShaderModuleSpy.callCount).to.equal(2);
      chaiExcept(createComputePipelineSpy.callCount).to.equal(1);
      chaiExcept(createRenderPipelineSpy.callCount).to.equal(1);

      const createComputePipelineCall = createComputePipelineSpy.getCall(0);
      const createRenderPipelineCall = createRenderPipelineSpy.getCall(0);

      const createComputePipelineArgs = createComputePipelineCall.args[0];
      const createRenderPipelineArgs = createRenderPipelineCall.args[0];

      for (let idx = 0; idx < 2; idx++) {
        const createPipelineLayoutCall = createPipelineLayoutSpy.getCall(idx);
        const createShaderModuleCall = createShaderModuleSpy.getCall(idx);

        const createPipelineLayoutArgs = createPipelineLayoutCall.args[0];
        const shaderModule = createShaderModuleCall.returnValue;

        const pipelineBindGroupLayouts = Array.from(createPipelineLayoutArgs.bindGroupLayouts)
        for (let bind_idx = 0; bind_idx < pipelineBindGroupLayouts.length; bind_idx++) {
          const createBindGroupLayoutCall = createBindGroupLayoutSpy.getCall(bindGroupLayoutIdx);
          const bindGroupLayout = createBindGroupLayoutCall.returnValue;
          chaiExcept(pipelineBindGroupLayouts[bind_idx]).to.equal(bindGroupLayout);
          bindGroupLayoutIdx++;
        }

        if (idx == 0) {
          chaiExcept(createPipelineLayoutArgs.label).to.equal("computations - pipeline layout");
          chaiExcept(createComputePipelineArgs.label).to.equal("computations - pipeline");
          chaiExcept(createComputePipelineArgs.layout).to.equal(createPipelineLayoutCall.returnValue);
          chaiExcept(createComputePipelineArgs.compute.module).to.equal(shaderModule);
        }
        else if (idx == 1) {
          chaiExcept(createPipelineLayoutArgs.label).to.equal("display - pipeline layout");
          chaiExcept(createRenderPipelineArgs.label).to.equal("display - pipeline");
          chaiExcept(createRenderPipelineArgs.layout).to.equal(createPipelineLayoutCall.returnValue);
          chaiExcept(createRenderPipelineArgs.vertex).to.not.be.null;
          chaiExcept(createRenderPipelineArgs.vertex.module).to.equal(shaderModule);
          chaiExcept(createRenderPipelineArgs.fragment).to.not.be.null;
          chaiExcept(createRenderPipelineArgs.fragment?.module).to.equal(shaderModule);
          chaiExcept(Array.from(createRenderPipelineArgs.fragment!.targets)[0]!.format).to.equal(engine!.canvasFormat);
        }
      }
    })
  })

  describe("GPUEngine's execute function", () => {
    it("runs and tests computations from the gpu", () => { 
      chaiExcept(engine).to.not.be.null;
    })
  })
})

