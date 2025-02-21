// Create a specific WGSL source type
type WGSLSource = string & { __wgsl?: never };
type WGSLImport = { default: WGSLSource };

// Union type for the hook parameter
export type ShaderSource = WGSLSource | WGSLImport;

export interface GPUShaderConfig {
  type: 'render' | 'compute';
  entryPoint: string;
  vertexEntryPoint?: string;
  fragmentEntryPoint?: string;
}

export interface GPURef {
  device?: GPUDevice | null;
  context?: GPUCanvasContext | null;
  pipeline?: GPUComputePipeline | GPURenderPipeline | null;
  bindGroups: Map<string, GPUBindGroup>;
  buffers: Map<string, GPUBuffer>;
  textures: Map<string, GPUTexture>;
}

export interface UseWebGPUBuffer {
  size: number;
  // one of GPUBufferUsage, use bitwise-or for multiple use cases
  usage: number;
  data?: Array<any>;
}

export interface UseWebGPUBindGroup {
  layout?: GPUBindGroupLayout;
  entries: Array<GPUBindGroupEntry>;
}

export interface UseWebGPUResource {
  name: string;
  type: 'buffer' | 'bindGroup';
  payload: UseWebGPUBuffer | UseWebGPUBindGroup;
}