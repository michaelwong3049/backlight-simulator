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
  readonly shaderDetails: GPUEngineShaderDetails;
  readonly shaderType: 'compute' | 'render';

  device?: GPUDevice;
  pipeline?: GPUComputePipeline | GPURenderPipeline | null;
  canvas?: HTMLCanvasElement;
  context?: GPUCanvasContext | null;

  private currentBindGroupState: Array<Array<string>> = [];
  private desiredBindGroupState: Array<Array<string>> = [];
  private bindGroups: Array<GPUBindGroup> = []; 
  private buffers = new Map<string, GPUBuffer>(); 

  private isProcessingOperation = false;

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

    this.desiredBindGroupState = bindGroups;
  }

  cleanup() {
    this.buffers.forEach((buf) => buf.destroy());
    this.buffers.clear();
  }

  // overspecified for compute shader
  async execute(workgroupCount: [number, number, number]) {
    if (this.isProcessingOperation) return Promise.reject('GPU operation in progress');
    const device = this.validateDevice(this.device);

    if (!this.areBindGroupsEqual(this.currentBindGroupState, this.desiredBindGroupState)) {
      this.bindGroups = this.initBindGroups(device, this.desiredBindGroupState);
      this.currentBindGroupState = this.desiredBindGroupState;
    }

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
    const device = this.validateDevice(this.device);
    
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
    });

    return buffers;
  }

  createBuffer(bufferDescription: GPUEngineBuffer, bindGroupIdx: number) {
    const device = this.validateDevice(this.device);
    const { name, sizeInBytes: size, usage, data } = bufferDescription;

    if (this.buffers.has(name)) {
      throw new Error(`Failed to create buffer, buffer named "${name}" exists already`);
    }

    const buffer = device.createBuffer({
      size,
      usage,
    });
    this.buffers.set(name, buffer);

    if (this.currentBindGroupState.length !== 0) {
      this.desiredBindGroupState = this.currentBindGroupState;
    }

    this.desiredBindGroupState[bindGroupIdx].push(name);
  }

  private initBindGroups(device: GPUDevice, bindGroupDescriptions: Array<Array<string>>) {
    const bindGroups: Array<GPUBindGroup> = [];

    bindGroupDescriptions.forEach((desc) => {
      const bg = device.createBindGroup({
        // does this index need to change?
        layout: this.pipeline!.getBindGroupLayout(0),
        entries: desc.map((bufferName, nestedIdx) => {
          const buffer = this.buffers.get(bufferName);
          if (!buffer)
            throw new Error(`Failed to create bind groups: could not find a buffer named ${bufferName}`)

          return { binding: nestedIdx, resource: { buffer }};
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

  private areBindGroupsEqual(current: Array<Array<string>>, prev: Array<Array<string>>) {
    const currentBindGroupState = current;
    const desiredBindGroupState = prev;
    // return true if current is out of sync with desired
    if(currentBindGroupState.length !== desiredBindGroupState.length) return false;
    
    for(let bindGroup = 0; bindGroup < currentBindGroupState.length; bindGroup++) {
      let currCurrentBindGroup = currentBindGroupState[bindGroup];
      let currDesiredBindGroup = desiredBindGroupState[bindGroup];
      if(currCurrentBindGroup.length !== currDesiredBindGroup.length) return false;

      for(let buffer = 0; buffer < currDesiredBindGroup.length; buffer++) {
        // funny naming?
        if(currCurrentBindGroup[buffer] != currDesiredBindGroup[buffer]) {
          return false;
        }
      }
    }

    return true;
  }
}