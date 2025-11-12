import { ShaderSource } from '@/types/webGPU';
import { kMaxLength } from 'buffer';

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
}

export default class GPUEngine {
  device: GPUDevice;
  canvasFormat: GPUTextureFormat;

  shaders: Map<string, GPUComputePipeline | GPURenderPipeline>;

  readonly shaderDetails: GPUEngineShaderDetails;
  readonly shaderType: 'compute' | 'render';

  // pipeline?: GPUComputePipeline | GPURenderPipeline | null;
  canvas?: HTMLCanvasElement;
  context?: GPUCanvasContext | null;

  private currentBindGroupState: Array<Array<string>> = [];
  private desiredBindGroupState: Array<Array<string>> = [];
  private bindGroups = new Map<string, GPUBindGroup>();
  private buffers = new Map<string, GPUBuffer>(); 

  private isProcessingOperation = false;

  constructor(device: GPUDevice, canvasFormat: GPUTextureFormat, shaderToPipeline: Map<string, GPUComputePipeline | GPURenderPipeline>) {
    this.device = device;
    this.canvasFormat = canvasFormat;
    this.shaders = shaderToPipeline;
  }

  static async initialize(shaders: { [name: string]: GPUEngineShaderDetails }): Promise<GPUEngine> {
    if (!navigator.gpu) throw new Error('WebGPU not supported');

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');
  
    const device = await adapter.requestDevice();
    if (!device) throw new Error('Failed to get GPU device');

    const shaderToPipeline = new Map<string, GPUComputePipeline | GPURenderPipeline>();
    Object.entries(shaders).forEach(([key, val]) => {
      let pipeline = GPUEngine.initializePipeline(device, val)
      shaderToPipeline.set(key, pipeline);
    });

    return new GPUEngine(device, navigator.gpu.getPreferredCanvasFormat(), shaderToPipeline);
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
  async execute(workgroupCount: [number, number, number]) {
    if (this.isProcessingOperation) return Promise.reject('GPU operation in progress');
    const { device } = this;

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    
    computePass.setPipeline(this.pipeline! as GPUComputePipeline);
    this.bindGroups.forEach((group, idx) => computePass.setBindGroup(idx, group));
    
    this.isProcessingOperation = true;
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
      
    this.isProcessingOperation = true;
    device.queue.writeBuffer(buffer, 0, data)
    await device.queue.onSubmittedWorkDone();
    this.isProcessingOperation = false;
  }
  
  async readBuffer(name: string): Promise<ArrayBuffer> {
    const { device } = this;
    
    const buffer = this.buffers.get(name);
    if (!buffer) throw new Error(`Could not find a buffer named ${name}`)

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

  private static initializePipeline(device: GPUDevice, shader: GPUEngineShaderDetails) { 
    const code = typeof shader.source === 'string' ? shader.source : shader.source.default;
    const shaderModule = device.createShaderModule({ code });

    if (shader.type === "compute") {
      return device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: shaderModule,
          entryPoint: shader.computeEntryPoint ?? 'computeMain',
        }
      });
    } else if (shader.type === 'render') {
      return device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: shader.vertexEntryPoint ?? 'vertexMain',
        },
        fragment: {
          module: shaderModule,
          entryPoint: shader.fragmentEntryPoint ?? 'fragmentMain',

          // TODO: we'll need this eventually
          targets: [null],
        },
      });
    } else {
      throw new Error("shader.type is not compute or not render");
    }
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

  // [ ['settingsBuffer'], ['frameDataBuffer', 'colorDivisionOutBuffer'] ]
  // each object is the @group(n), each buffer is the @binding(n) respective to the index
  createBindGroups(bindGroupDescriptions: Array<{ name: string, visibility: number, buffers: Array<string> }>) {
    const { device, buffers, bindGroups } = this;

    bindGroupDescriptions.forEach((group, groupIndex) => {
      const layout = device.createBindGroupLayout({
        label: `${group.name} - layout`,
        entries: [
          {
            binding: groupIndex,
            visibility: group.visibility,
          }
        ]
      });

      const bindGroup = device.createBindGroup({
        layout: layout,
        // list of buffers assigned to this bind group
        entries: group.buffers.map((bufferName, bufferIndex) => {
          return {
            binding: bufferIndex,
            resource: { buffer: buffers.get(bufferName)! }
          };
        })
      });

      bindGroups.set(group.name, bindGroup);
    });
  }
}
