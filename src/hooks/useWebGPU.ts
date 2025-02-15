import { useEffect, useRef, useState } from 'react'; 
import { GPUBufferUsage } from '@/constants';

// Type of resource to create
const ResourceType = {
  BUFFER: 'buffer',
  TEXTURE: 'texture',
  BIND_GROUP: 'bindGroup'
};

interface GPUShaderConfig {
  type: 'render' | 'compute';
  entryPoint: string;
  vertexEntryPoint?: string;
  fragmentEntryPoint?: string;
}
 
interface GPURef {
  device?: GPUDevice | null;
  context?: GPUCanvasContext | null;
  pipeline?: GPUComputePipeline | GPURenderPipeline | null;
  bindGroups: Map<string, GPUBindGroup>;
  buffers: Map<string, GPUBuffer>;
  textures: Map<string, GPUTexture>;
}

interface UseWebGPUResource {
  name: string;
  type: 'buffer' | 'texture' | 'bindGroup';
  size: number;
  usage: GPUBufferUsage;
  data?: Array<any>;
}

interface UseWebGPUParams {
  shaderModule: string;
  pipelineConfig: GPUShaderConfig;
  resources: Array<UseWebGPUResource>;
  workgroupSize: Array<number>;
  canvas?: HTMLCanvasElement;
}

const useWebGPU = ({
  // Shader configuration
  shaderModule,
  pipelineConfig,
  
  // Resource definitions
  resources,
  
  // Optional configurations
  workgroupSize = [64, 1, 1],
  canvas,
}: UseWebGPUParams) => {
  const [gpuReady, setGpuReady] = useState(false);
  const [error, setError] = useState<GPUError>();
  
  const gpuRef = useRef<GPURef>({
    device: null,
    context: null,
    pipeline: null,
    bindGroups: new Map(),
    buffers: new Map(),
    textures: new Map()
  });

  // Initialize WebGPU
  useEffect(() => {
    const initWebGPU = async () => {
      try {
        if (!navigator.gpu) {
          throw new Error('WebGPU not supported');
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          throw new Error('No GPU adapter found');
        }

        const device = await adapter.requestDevice();
        gpuRef.current.device = device;
        if(!device) return;

        // Set up context if canvas is provided
        if (canvas) {
          const context = canvas.getContext('webgpu');
          const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
          context?.configure({
            device,
            format: canvasFormat,
            alphaMode: 'premultiplied',
          });
          gpuRef.current.context = context;
        }

        // Create shader module
        const shader = device.createShaderModule({
          code: shaderModule
        });

        // Create pipeline based on config type
        if (pipelineConfig.type === 'compute') {
          gpuRef.current.pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
              module: shader,
              entryPoint: pipelineConfig.entryPoint || 'main',
            }
          });
        }
        //  else if (pipelineConfig.type === 'render') {
        //   gpuRef.current.pipeline = device.createRenderPipeline({
        //     layout: 'auto',
        //     vertex: {
        //       module: shader,
        //       entryPoint: pipelineConfig.vertexEntryPoint || 'vertexMain',
        //     },
        //     fragment: {
        //       module: shader,
        //       entryPoint: pipelineConfig.fragmentEntryPoint || 'fragmentMain',
        //       targets: [{
        //         format: canvasFormat ?? undefined,
        //       }],
        //     },
        //     primitive: pipelineConfig.primitive || {
        //       topology: 'triangle-list',
        //     },
        //   });
        // }

        // Initialize resources
        await initializeResources(resources);

        device.addEventListener('uncapturederror', (event) => {
          setError(event.error);
        });

        setGpuReady(true);
      } catch (err) {
        setError(err as GPUError);
        console.error('WebGPU initialization failed:', err);
      }
    };

    initWebGPU();

    return () => cleanup();
  }, [shaderModule]);

  const initializeResources = async (resources: Array<UseWebGPUResource>) => {
    for (const resource of resources) {
      switch (resource.type) {
        case ResourceType.BUFFER:
          createBuffer(resource);
          break;
        // case ResourceType.BIND_GROUP:
        //   createBindGroup(resource);
        //   break;
        // case ResourceType.TEXTURE:
        //   createTexture(resource);
        //   break;
      }
    }
  };

  const createBuffer = ({ name, size, usage, data }: UseWebGPUResource) => {
    const { device } = gpuRef.current;
    if (!device) return;
    
    // Clean up existing buffer if it exists
    if (gpuRef.current.buffers.has(name)) {
      gpuRef.current.buffers.get(name)!.destroy();
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

    gpuRef.current.buffers.set(name, buffer);
    return buffer;
  };

  // const createBindGroup = ({ name, layout, entries }) => {
  //   const { device, pipeline } = gpuRef.current;
  //   if (!device || !pipeline) return;

  //   const bindGroup = device.createBindGroup({
  //     layout: layout || pipeline.getBindGroupLayout(0),
  //     entries
  //   });
  //   gpuRef.current.bindGroups.set(name, bindGroup);
  //   return bindGroup;
  // };

  // const createTexture = ({ name, size, format, usage, data }) => {
  //   const { device } = gpuRef.current;
  //   if (!device) return;
    
  //   // Clean up existing texture if it exists
  //   if (gpuRef.current.textures.has(name)) {
  //     gpuRef.current.textures.get(name)!.destroy();
  //   }

  //   const texture = device.createTexture({
  //     size,
  //     format,
  //     usage
  //   });

  //   if (data) {
  //     device.queue.writeTexture(
  //       { texture },
  //       data,
  //       { bytesPerRow: size.width * 4 },
  //       size
  //     );
  //   }

  //   gpuRef.current.textures.set(name, texture);
  //   return texture;
  // };

  const dispatch = async (workgroupCount = [1, 1, 1], bindGroups = []) => {
    if (!gpuReady) return;

    const { device, pipeline } = gpuRef.current;
    if (!device || !pipeline) return;

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    
    computePass.setPipeline(pipeline as GPUComputePipeline);
    
    bindGroups.forEach((group, index) => {
      computePass.setBindGroup(index, group);
    });
    
    computePass.dispatchWorkgroups(1,1,1);
    computePass.end();
    
    device.queue.submit([commandEncoder.finish()]);
  };

  const cleanup = () => {
    const { buffers, textures, device } = gpuRef.current;
    
    // Destroy buffers
    buffers.forEach(buffer => buffer.destroy());
    buffers.clear();
    
    // Destroy textures
    textures.forEach(texture => texture.destroy());
    textures.clear();
    
    // Optional: force device loss
    // if (device) device.destroy();
  };

  return {
    gpuReady,
    error,
    ...gpuRef.current,
    dispatch,
    createBuffer,
    // createBindGroup,
    // createTexture,
    cleanup
  };
};

export { useWebGPU, ResourceType };