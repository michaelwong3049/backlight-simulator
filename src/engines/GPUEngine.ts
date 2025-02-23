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
}

export default class GPUEngine {
  readonly shaderDetails: GPUEngineShaderDetails;
  readonly shaderType: 'compute' | 'render';
  
  device?: GPUDevice;
  pipeline?: GPUComputePipeline | GPURenderPipeline | null;
  canvas?: HTMLCanvasElement;
  context?: GPUCanvasContext | null;

  private bindGroups: Array<GPUBindGroup> = []; 
  private buffers = new Map<string, GPUBuffer>(); 

  private isProcessingOperation = false;
  isReady = false;

  constructor(shader: GPUEngineShaderDetails, canvas?: HTMLCanvasElement) {
    this.shaderDetails = shader;
    this.canvas = canvas;
    this.shaderType = shader.type;

    if (shader.type === 'render') {
      console.warn('GPUEngine does not fully support render pipelines yet');
    }
  }

  // bindGroups is array of buffer names created, top level arr is bind group idx
  async initialize(buffers: Array<GPUEngineBuffer>, bindGroups: Array<Array<string>>) {
    this.device = await this.initGPUDevice();

    const shader = this.device.createShaderModule({ code: this.getShaderCode(this.shaderDetails.source) });
    this.pipeline = this.initPipeline(this.device, shader, this.shaderDetails);

    this.context = this.initCanvas(this.device, this.canvas);
    this.buffers = this.initBuffers(this.device, buffers);
    this.bindGroups = this.initBindGroups(this.device, bindGroups);
    this.isReady = true;
  }

  cleanup() {
    this.buffers.forEach((buf) => buf.destroy());
    this.buffers.clear();
  }

  // overspecified for compute shader
  async execute(workgroupCount: [number, number, number]) {
    if (this.isProcessingOperation) return Promise.reject('GPU operation in progress');
    const device = this.validateDevice(this.device);

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
    const device = this.validateDevice(this.device);
    
    const buffer = this.buffers.get(name);
    if (!buffer) throw new Error(`Could not find a buffer named ${name}`)
      
    this.isProcessingOperation = true;
    device.queue.writeBuffer(buffer, 0, data)
    await device.queue.onSubmittedWorkDone();
    this.isProcessingOperation = false;
  }
  
  async readBuffer(name: string): Promise<ArrayBuffer> {
    this.validateDevice(this.device);
    
    const staging = this.buffers.get('$staging')!;
    const buffer = this.buffers.get(name);
    if (!buffer) throw new Error(`Could not find a buffer named ${name}`)
      
    try {
      this.isProcessingOperation = true;
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
  
  private async initGPUDevice() {
    if (!navigator.gpu) throw new Error('WebGPU not supported');

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');
  
    const device = await adapter.requestDevice();
    if (!device) throw new Error('Failed to get GPU device');
  
    return device;
  }

  private initPipeline(device: GPUDevice, shader: GPUShaderModule, details: GPUEngineShaderDetails) { 
    if (details.type === 'compute') {
      return device.createComputePipeline({
        layout: 'auto',
        compute: {
          module: shader,
          entryPoint: details.computeEntryPoint || 'computeMain',
        }
      });
    } else if (details.type === 'render') {
      return device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shader,
          entryPoint: details.vertexEntryPoint || 'vertexMain',
        },
        fragment: {
          module: shader,
          entryPoint: details.fragmentEntryPoint || 'fragmentMain',
          targets: [null],
        },
      });
    }
  }

  private initCanvas(device: GPUDevice, canvas?: HTMLCanvasElement) {
    if (!canvas) return null; 
  
    const context = canvas.getContext('webgpu');
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context?.configure({
      device,
      format: canvasFormat,
      alphaMode: 'premultiplied',
    });
  
    return context;
  }

  private initBuffers(device: GPUDevice, bufferDescriptions: Array<GPUEngineBuffer>) {
    const buffers = new Map<string, GPUBuffer>();
    let maxBufferSizeInBytes = 0;

    bufferDescriptions.forEach((desc) => {
      const { name, sizeInBytes: size, usage, data } = desc;

      // delete any buffer with this name already
      if (buffers.has(name)) {
        buffers.get(name)!.destroy();
      }

      const buffer = device.createBuffer({
        size,
        usage,
        mappedAtCreation: !!data
      });

      if (data) {
        new Float32Array(buffer.getMappedRange()).set(data);
        buffer.unmap();
      }

      buffers.set(name, buffer);

      if (size > maxBufferSizeInBytes) maxBufferSizeInBytes = size;
    }); 

    // set special internal staging buffer
    const staging = device.createBuffer({
      size: maxBufferSizeInBytes,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    })
    buffers.set('$staging', staging);

    return buffers;
  }

  private initBindGroups(device: GPUDevice, bindGroupDescriptions: Array<Array<string>>) {
    const bindGroups: Array<GPUBindGroup> = [];

    bindGroupDescriptions.forEach((desc, idx) => {
      const bg = device.createBindGroup({
        // does this index need to change?
        layout: this.pipeline!.getBindGroupLayout(0),
        entries: desc.map((bufferName) => {
          const buffer = this.buffers.get(bufferName);
          if (!buffer)
            throw new Error(`Failed to create bind groups: could not find a buffer named ${bufferName}`)

          return { binding: idx, resource: { buffer }};
        })
      });

      bindGroups.push(bg);
    });

    return bindGroups;
  }

  // Helper function to get the shader code string
  private getShaderCode(source: ShaderSource): string {
    if (typeof source === 'string') {
      return source;
    }
    return source.default;
  }

  private validateDevice(device?: GPUDevice): GPUDevice {
    if (!device) {
      throw new Error('GPU Device not initialized, did you call `initialize`?')
    }

    return device;
  }
}