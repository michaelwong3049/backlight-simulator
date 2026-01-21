import { ShaderSource } from '@/types/webGPU';

export interface GPUEngineBuffer {
  name: string;
  sizeInBytes: number;
  label: string;
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

  videoInputTexture: GPUTexture;
  videoOutputTexture: GPUTexture;

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
    videoInputTexture: GPUTexture, 
    videoOutputTexture: GPUTexture,
    buffers: Map<string, GPUBuffer | GPUTexture>
  ) {
      this.device = device;
      this.canvasFormat = canvasFormat;
      // this.shaders = shaderToPipeline;
      this.videoInputTexture = videoInputTexture;
      this.videoOutputTexture = videoOutputTexture;
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

    const videoInputTexture = device.createTexture({
      label: "videoInputTexture",
      format: preferredCanvasFormat,
      size: [videoWidth, videoHeight],
      // usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST // | GPUTextureUsage.RENDER_ATTACHMENT // | GPUTextureUsage.STORAGE_BINDING
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    })

    const videoOutputTexture = device.createTexture({
      label: "videoOutputTexture",
      // format: preferredCanvasFormat,
      format: 'rgba8unorm',
      size: [1089, 848],
      // usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST // | GPUTextureUsage.RENDER_ATTACHMENT // | GPUTextureUsage.STORAGE_BINDING
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
    })

    GPU_BUFFERS.forEach(({ name, label, sizeInBytes: size, usage }) => {
      buffers.set(name, device.createBuffer({ size, usage, label }))
    })
    buffers.set(videoInputTexture.label, videoInputTexture); // TODO: fix here?!?!??!!
    buffers.set(videoOutputTexture.label, videoOutputTexture); // TODO: fix here?!?!??!!

    return new GPUEngine(device, preferredCanvasFormat, videoInputTexture, videoOutputTexture, buffers);
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

    const { device, shaders, videoInputTexture } = this;
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

    // TODO: maybe we can dynamically do this but im gonna hard code this right now
    computePass.setBindGroup(0, this.bindGroups.get("settingsBindGroup"))
    computePass.setBindGroup(1, this.bindGroups.get("dataBindGroup"))

    // let bindIdx = 0;
    // this.bindGroups.forEach((bindGroup, name) => {
    //   computePass.setBindGroup(bindIdx++, bindGroup)
    // });

    //  console.log("index: ", index)
    //   computePass.setBindGroup(index, bindGroup)
    // });

    const [xGroups, yGroups, zGroups] = workgroupCount
    computePass.dispatchWorkgroups(xGroups, yGroups, zGroups);
    computePass.end();

    device.queue.submit([commandEncoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    const renderEncoder = device.createCommandEncoder();
    const renderPass = renderEncoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear' as GPULoadOp,
        storeOp:'store' as GPUStoreOp,
      }]
    })

    renderPass.setPipeline(shaders.get("videoMapper") as GPURenderPipeline);
    renderPass.setBindGroup(0, this.bindGroups.get("textureDataBindGroup"));
    renderPass.draw(3);
    renderPass.end();

    device.queue.submit([renderEncoder.finish()]);
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


  private createBindGroupAndLayout(name: string, visibility: number, resourcesTemplate: string[], shaderType: 'compute' | 'render'): { bindGroup: GPUBindGroup, layout: GPUBindGroupLayout} {
    const { buffers, device } = this;
    const layoutEntries: GPUBindGroupLayoutEntry[] = resourcesTemplate.map((bufferName, bufferIndex) => {
      const buffer = buffers.get(bufferName);
      if (!buffer) throw new Error(`buffer ${bufferName} does not exist....`);

      const entry: GPUBindGroupLayoutEntry = {
        binding: bufferIndex,
        visibility,
      };

      if (shaderType === 'render') {
        // TODO(michaelwong): check if {} is required for entry.texture.
        entry.texture = buffer instanceof GPUTexture ? {} : undefined;
        entry.buffer = !entry.texture ? { type: 'read-only-storage' } : undefined;
        return entry;
      }

      if (shaderType === 'compute') {
        if (buffer instanceof GPUTexture) {
          entry.texture = bufferName === 'videoInputTexture' ? {} : undefined;
          entry.storageTexture = !entry.texture ?  {
              access: "write-only",
              format: "rgba8unorm"
              // format: buffer.format
            } : undefined;

          return entry;
        } else if (buffer instanceof GPUBuffer) {
          entry.buffer = { 
            type: shaderType === 'compute' ? 'storage' : 'read-only-storage' 
          };
          return entry;
        }
      }

      throw new Error("shaderType was not one of 'render' or 'compute'.");
    });
    
    const layout = device.createBindGroupLayout({
      label: name,
      entries: layoutEntries,
    });

    // Create the bind group using its specific layout
    const bindGroup = device.createBindGroup({
      label: name,
      layout,
      entries: resourcesTemplate.map((resourceName, resourceIndex) => {
        const buffer = buffers.get(resourceName);
        if (!buffer) throw new Error(`buffer ${resourceName} does not exist....`);

        return {
          binding: resourceIndex,
          resource: buffer instanceof GPUTexture 
            ? buffer.createView() 
            : { buffer: buffer as GPUBuffer }
        };
      })
    });

    return { bindGroup, layout };
  }

  private createShaderPipelineLayout(name: string, details: GPUEngineShaderDetails) {
    const { device } = this;

    // Create all of the bind groups for a single shader
    const allBindGroupLayoutsForShader: GPUBindGroupLayout[] = []; 
    
    // For each bind group defined in the shader, create the bind group layout (to pre-allocate GPU resources)
    // TODO: change buffers: buffersTemplate to like resources: resourcesTemplate or something (done) ... next step is to change buffers too
    details.bindGroups.forEach(({ name: bindGroupName, visibility, buffers: resourcesTemplate }, groupIndex) => {
      // Create actual bind group and its layout according to the templates provided in details.bindGroup
      const { bindGroup, layout } = this.createBindGroupAndLayout(bindGroupName, visibility, resourcesTemplate, details.type);
      allBindGroupLayoutsForShader.push(layout);

      // Store the bind group so it can be used later
      this.bindGroups.set(bindGroupName, bindGroup);
    });

    return device.createPipelineLayout({
      bindGroupLayouts: allBindGroupLayoutsForShader,
      label: `${name}`,
    });
  }
 
  /**
   * TODO(michaelwong): fill this out with something helpful so we don't forget what it
   * does in 2 weeks
   * This function something something...
   * 
   * @param shaders 
   */
  createPipeline(shaders: { [name: string]: GPUEngineShaderDetails }) {
    const { device, buffers, canvasFormat } = this;

    // Create a map to hold the final shader pipeline by name
    const shaderToPipeline = new Map<string, GPUComputePipeline | GPURenderPipeline>();

    // For each shader, create the shader pipeline object and set it in the map
    Object.entries(shaders).forEach(([name, details]) => {
      const isValidShaderType = details.type === 'compute' || details.type === 'render';
      if (!isValidShaderType)
        throw new Error("shader.type is not compute or render");

      // Create all of the resources to build a GPU shader (code, GPU layout declarations, etc.)
      const code = typeof details.source === 'string' ? details.source : details.source.default;
      const shaderModule = device.createShaderModule({ code, label: name });
      const shaderPipelineLayout = this.createShaderPipelineLayout(name, details);

      if (details.type === 'compute') {
        const computePipeline = device.createComputePipeline({
          label: `${name} - pipeline`,
          layout: shaderPipelineLayout,
          compute: { module: shaderModule }
        });
        shaderToPipeline.set(name, computePipeline);
      } else {
        // If it's not a compute pipeline, then it must be a render pipeline
        const renderPipeline = device.createRenderPipeline({
          label: `${name} - pipeline`,
          layout: shaderPipelineLayout,
          vertex: { module: shaderModule },
          fragment: {
            module: shaderModule,
            targets: [{ format: canvasFormat }],
          },
        });
        shaderToPipeline.set(name, renderPipeline);
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
      const { name, label, sizeInBytes: size, usage, data } = desc;

      // console.log("label: ", label);

      if (this.buffers.has(name)) {
        return;
        throw new Error(`Failed to create buffer, buffer named "${name}" exists already`);
      }

      const buffer = device.createBuffer({
        size,
        usage,
        label
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
        buffer: { type: "read-only-storage" as GPUBufferBindingType }
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

  async updateTexture(videoWidth: number, videoHeight: number) {
    const { device, canvasFormat } = this;

    this.videoInputTexture.destroy();

    await device.queue.onSubmittedWorkDone();

    const texture = device.createTexture({
      label: "videoInputTexture",
      format: canvasFormat,
      size: [videoWidth, videoHeight],
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
  
    this.videoInputTexture = texture;
  }

  private sendVideoData(video: HTMLVideoElement) {
    const { device, videoInputTexture } = this;

    device.queue.copyExternalImageToTexture(
      { source: video },
      { texture: videoInputTexture },
      [video.videoWidth, video.videoHeight]
    )
  }
}
