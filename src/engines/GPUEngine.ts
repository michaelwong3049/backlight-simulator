import { ShaderSource } from '@/types/webGPU';

export interface GPUEngineBuffer {
  name: string;
  sizeInBytes: number;
  usage: number; // one of GPUBufferUsage, use bitwise-or for multiple use cases
  data?: Array<number>;
}

export interface GPUEngineShaderDetails {
  source: ShaderSource;
  type: 'render' | 'compute';
  computeEntryPoint?: string;
  vertexEntryPoint?: string;
  fragmentEntryPoint?: string;
  bindGroups: Array<{ name: string, visibility: number, buffers: Array<string> }>;
}

export default class GPUEngine {
  device: GPUDevice;
  canvasFormat: GPUTextureFormat;

  shaders?: Map<string, GPUComputePipeline | GPURenderPipeline>;

  videoTexture: GPUTexture;

  // pipeline?: GPUComputePipeline | GPURenderPipeline | null;
  canvas?: HTMLCanvasElement;
  context?: GPUCanvasContext | null;

  private currentBindGroupState: Array<Array<string>> = [];
  private desiredBindGroupState: Array<Array<string>> = [];
  private bindGroups = new Map<string, GPUBindGroup>();
  private buffers = new Map<string, GPUBuffer | GPUTexture>(); 

  private isProcessingOperation = false;

  constructor(
    device: GPUDevice, 
    canvasFormat: GPUTextureFormat, 
    // shaderToPipeline: Map<string, GPUComputePipeline | GPURenderPipeline>, 
    videoTexture: GPUTexture, 
    buffers: Map<string, GPUBuffer | GPUTexture>
  ) {
      this.device = device;
      this.canvasFormat = canvasFormat;
      // this.shaders = shaderToPipeline;
      this.videoTexture = videoTexture;
      this.buffers = buffers;
  }

  static async initialize(videoWidth: number, videoHeight: number, GPU_BUFFERS: Array<GPUEngineBuffer>): Promise<GPUEngine> {
    if (!navigator.gpu) throw new Error('WebGPU not supported');

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');

    const device = await adapter.requestDevice();
    if (!device) throw new Error('Failed to get GPU device');

    // TODO: speicify for 32 bit value? https://webgpufundamentals.org/webgpu/lessons/webgpu-bind-group-layouts.html - rgba32float
    const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat();

    // const shaderToPipeline = new Map<string, GPUComputePipeline | GPURenderPipeline>();
    // Object.entries(shaders).forEach(([name, shader]) => {
    //   let pipeline = GPUEngine.initializePipeline(device, shader, preferredCanvasFormat)
    //   shaderToPipeline.set(name, pipeline);
    // });

    let buffers = new Map<string, GPUBuffer | GPUTexture>();

    // TODO: currently going to add this texture to the buffers map, this is likely NOT best practitce, but i wanna get stuff working

    const texture = device.createTexture({
      label: "videoImageData",
      format: preferredCanvasFormat,
      size: [videoWidth, videoHeight],
      // usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST // | GPUTextureUsage.RENDER_ATTACHMENT // | GPUTextureUsage.STORAGE_BINDING
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    })

    GPU_BUFFERS.forEach(({ name, sizeInBytes: size, usage }) => {
      buffers.set(name, device.createBuffer({ size, usage }))
    })
    buffers.set(texture.label, texture); // TODO: fix here?!?!??!!

    return new GPUEngine(device, preferredCanvasFormat, texture, buffers);
  }

  prepareForRender(shaders: { [name: string]: GPUEngineShaderDetails }) {
    const { device, canvasFormat } = this;

    const shaderToPipeline = new Map<string, GPUComputePipeline | GPURenderPipeline>();
    Object.entries(shaders).forEach(([name, shader]) => {
      let pipeline = GPUEngine.initializePipeline(device, shader, canvasFormat)
      shaderToPipeline.set(name, pipeline);
    });

    this.shaders = shaderToPipeline;
  }

  initializeCanvas(canvas: HTMLCanvasElement) {  
    const context = canvas.getContext('webgpu');
    context!.configure({
      device: this.device,
      format: this.canvasFormat
    });

    return context;
  }

  cleanup() {
    this.buffers.forEach((buf) => buf.destroy());
    this.buffers.clear();
  }

  // overspecified for compute shader
  async execute(video: HTMLVideoElement, ctx: GPUCanvasContext, workgroupCount: [number, number, number]) {
    if (this.isProcessingOperation) return Promise.reject('GPU operation in progress');

    const { device, shaders, videoTexture } = this;
    if (!shaders) throw new Error("You have not called `prepareForRender` yet");

    this.isProcessingOperation = true;
  
    this.sendVideoData(video);

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    // const renderPass = commandEncoder.beginRenderPass();
    // computePass.setPipeline(this.pipeline! as GPUComputePipeline);

    // compute average colors
    computePass.setPipeline(shaders.get("convolution") as GPUComputePipeline);

    (shaders.get("convolution") as GPUComputePipeline).getBindGroupLayout(0)
    // computePass.setPipeline(shaders.get("videoMapper") as GPUComputePipeline);
    
    // console.log(this.bindGroups.keys());
    // console.table(this.bindGroups);

    let bindIdx = 0;
    this.bindGroups.forEach((bindGroup, name) => {
      console.log("something")
      console.log("name: ", name);
      computePass.setBindGroup(bindIdx++, bindGroup)
    });

    //  /console.log("index: ", index)
    //   computePass.setBindGroup(index, bindGroup)
    // });

    const [xGroups, yGroups, zGroups] = workgroupCount
    computePass.dispatchWorkgroups(xGroups, yGroups, zGroups);
    computePass.end();

    device.queue.submit([commandEncoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    this.isProcessingOperation = false;
  }

  // maybe overspecified for numbers?
  async writeBuffer(name: string, data: BufferSource | SharedArrayBuffer) {
    const { device } = this;

    const buffer = this.buffers.get(name);
    if (!buffer) throw new Error(`Could not find a buffer named ${name}`)
    if (buffer instanceof GPUTexture) throw new Error(`ERROR: writing to a GPUTexture named ${name}, not a GPUBuffer`);

    this.isProcessingOperation = true;
    device.queue.writeBuffer(buffer, 0, data)
    await device.queue.onSubmittedWorkDone();
    this.isProcessingOperation = false;
  }

  async readBuffer(name: string): Promise<ArrayBuffer> {
    const { device } = this;

    const buffer = this.buffers.get(name);
    if (!buffer) throw new Error(`Could not find a buffer named ${name}`)
    if (buffer instanceof GPUTexture) throw new Error(`ERROR: reading from texture is not a thing? ${name}`);

    const staging = device.createBuffer({
      size: buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(
      buffer,
      0,
      staging,
      0,
      buffer.size
    );

    try {
      this.isProcessingOperation = true;
      device.queue.submit([commandEncoder.finish()]);
      await device.queue.onSubmittedWorkDone();

      await staging.mapAsync(GPUMapMode.READ);
      const data = staging.getMappedRange().slice(0);
      staging.unmap();
      this.isProcessingOperation = false;
      return Promise.resolve(data)
    } catch (err) {
      return Promise.reject(`${err}`);
    } finally {
      this.isProcessingOperation = false;
    }
  }

  isProcessing() {
    return this.isProcessingOperation;
  }

  private static initializePipeline(
    device: GPUDevice,
    shader: GPUEngineShaderDetails, canvasFormat: GPUTextureFormat) { 
    const code = typeof shader.source === 'string' ? shader.source : shader.source.default;
    const shaderModule = device.createShaderModule({ code });

    if (shader.type === "compute") {
      return device.createComputePipeline({
        label: 'myCompute',
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: shader.computeEntryPoint ?? 'computeMain',
        }
      });
    } else if (shader.type === 'render') {
      return device.createRenderPipeline({
        layout: 'auto',
        label: 'myRender',
        vertex: {
          module: shaderModule,
          entryPoint: shader.vertexEntryPoint ?? 'vertexMain',
        },
        fragment: {
          module: shaderModule,
          entryPoint: shader.fragmentEntryPoint ?? 'fragmentMain',
          targets: [{ format: canvasFormat }],
        },
      });
    } else {
      throw new Error("shader.type is not compute or not render");
    }
  }

  createPipeline(shaders: { [name: string]: GPUEngineShaderDetails }) {
    const { device, buffers, canvasFormat } = this;
    const shaderToPipeline = new Map<string, GPUComputePipeline | GPURenderPipeline>();
    Object.entries(shaders).forEach(([name, details], index) => {
      const bindGroupTemplate = details.bindGroups;
      
      // Create a bind group layout for each bind group
      const bindGroupLayouts: GPUBindGroupLayout[] = [];
      bindGroupTemplate.forEach(({ name: bindGroupName, visibility, buffers: buffersTemplate }, groupIndex) => {
        const layoutEntries: GPUBindGroupLayoutEntry[] = buffersTemplate.map((bufferName, bufferIndex) => {
          const buffer = buffers.get(bufferName);
          if (!buffer) throw new Error(`buffer ${bufferName} does not exist....`);

          const entry: GPUBindGroupLayoutEntry = {
            binding: bufferIndex,
            visibility,
          };

          if (buffer instanceof GPUTexture) {
            entry.texture = {};
          } else {
            // For compute shaders, use read-write storage; for render, use read-only storage
            entry.buffer = { 
              type: details.type === 'compute' ? 'storage' : 'read-only-storage' 
            };
          }

          return entry;
        });

        const bindGroupLayout = device.createBindGroupLayout({
          label: `${name} - bind group ${groupIndex} layout`,
          entries: layoutEntries,
        });

        bindGroupLayouts.push(bindGroupLayout);

        // Create the bind group using its specific layout
        const bindGroup = device.createBindGroup({
          label: bindGroupName,
          layout: bindGroupLayout,
          entries: buffersTemplate.map((bufferName, bufferIndex) => {
            const buffer = buffers.get(bufferName);
            if (!buffer) throw new Error(`buffer ${bufferName} does not exist....`);

            return {
              binding: bufferIndex,
              resource: buffer instanceof GPUTexture 
                ? buffer.createView() 
                : { buffer: buffer as GPUBuffer }
            };
          })
        });

        // Store the bind group so it can be used later
        this.bindGroups.set(bindGroupName, bindGroup);
      });

      const code = typeof details.source === 'string' ? details.source : details.source.default;
      const shaderModule = device.createShaderModule({ code });

      // Create pipeline layout with all bind group layouts
      const shaderPipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: bindGroupLayouts,
        label: `${name} - pipeline layout`,
      });

      if (details.type === 'render') {
        const renderPipeline = device.createRenderPipeline({
          layout: shaderPipelineLayout,
          label: `${name} - pipeline`,
          vertex: {
            module: shaderModule,
            entryPoint: details.vertexEntryPoint ?? 'vertexMain',
          },
          fragment: {
            module: shaderModule,
            entryPoint: details.fragmentEntryPoint ?? 'fragmentMain',
            targets: [{ format: canvasFormat }],
          },
        });
        shaderToPipeline.set(name, renderPipeline);
      } else if (details.type === 'compute') {
        const computePipeline = device.createComputePipeline({
          label: 'myCompute',
          layout: shaderPipelineLayout,
          compute: {
            module: shaderModule,
            entryPoint: details.computeEntryPoint ?? 'computeMain',
          }
        });
        shaderToPipeline.set(name, computePipeline);
      } else {
        throw new Error("shader.type is not compute or render");
      }
    });

    this.shaders = shaderToPipeline;
  }

  hasBuffer(name: string) {
    return this.buffers.has(name);
  }

  // TODO(andy/michael): assume this is the primary
  createBuffers(bufferDescriptions: Array<GPUEngineBuffer>) { // bindGroupIdx: number) {
    const { device } = this;

    bufferDescriptions.forEach((desc) => {
      const { name, sizeInBytes: size, usage, data } = desc;

      if (this.buffers.has(name)) {
        throw new Error(`Failed to create buffer, buffer named "${name}" exists already`);
      }

      const buffer = device.createBuffer({
        size,
        usage,
      });
      this.buffers.set(name, buffer);
    });
  }

  destroyBuffer(name: string) {
    this.buffers.get(name)?.destroy();
  }

  // NOTE: im currently hard coding this to be:
  // settingsBuffer as the first binding ... so @group(0), @binding(0)
  // videoImageData and colorDivsionOutBuffer ... so @group(1), @binding(0) and @binding(1)
  createBindGroupLayoutEntry(group: { name: string, visibility: number, buffers: Array<string>} , groupIndex: number): Iterable<GPUBindGroupLayoutEntry> {
    if (groupIndex == 0) {
      return [{
        binding: groupIndex,
        visibility: group.visibility,
        buffer: { type: "storage" as GPUBufferBindingType }
      }]
    } else {
      return [
        {
          binding: 0,
          visibility: group.visibility,
          texture: {}
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
          buffer: { type: "storage" as GPUBufferBindingType }
        }
      ]
    }
  }

  // [ ['settingsBuffer'], ['frameDataBuffer', 'colorDivisionOutBuffer'] ]
  // each object is the @group(n), each buffer is the @binding(n) respective to the index
  // TODO(michaelwong): extend this function to fetch GPU textures as well if desired
  createBindGroups(bindGroupDescriptions: Array<{ name: string, visibility: number, buffers: Array<string> }>) {
    const { device, buffers, bindGroups } = this;

    bindGroupDescriptions.forEach((group, groupIndex) => {
      const entry = this.createBindGroupLayoutEntry(group, groupIndex);

      const layout = device.createBindGroupLayout({
        label: `${group.name} - layout`,
        entries: entry
      });

      //
      // const bindGroup = device.createBindGroup({
      //   layout: layout,
      //   // list of buffers assigned to this bind group
      //   entries: group.buffers.map((bufferName, bufferIndex) => {
      //     return {
      //       binding: bufferIndex,
      //       resource: { buffer: buffers.get(bufferName)! }
      //     };
      //   })
      // });

      // we were overspecifying this for buffers only... we are now using a GPUTexture

      const bindGroup = device.createBindGroup({
        label: group.name,
        layout,
        // list of buffers assigned to this bind group
        entries: group.buffers.map((bufferName, bufferIndex) => {
          const buffer = buffers.get(bufferName)

          if (!buffer) throw new Error(`buffer ${bufferName} does not exist....`);

          return {
            binding: bufferIndex,
            resource: buffer instanceof GPUTexture 
              ? buffer.createView() 
              : { buffer: buffer as GPUBuffer }
          };
        })
      });

      bindGroups.set(group.name, bindGroup);
    });
  }

  updateTexture(videoWidth: number, videoHeight: number) {
    const { device, canvasFormat } = this;

    this.videoTexture.destroy();

    const texture = device.createTexture({
      label: "videoImageData",
      format: canvasFormat,
      size: [videoWidth, videoHeight],
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
  
    this.videoTexture = texture;
  }

  private sendVideoData(video: HTMLVideoElement) {
    const { device, videoTexture } = this;

    console.log("sending video data...", video.videoWidth, video.videoHeight, " texture: ", videoTexture.height, videoTexture.width);

    device.queue.copyExternalImageToTexture(
      { source: video },
      { texture: videoTexture },
      [video.videoWidth, video.videoHeight]
    )
  }
}


