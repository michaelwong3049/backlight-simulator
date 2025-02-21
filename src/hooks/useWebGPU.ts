import { useEffect, useRef, useState } from 'react'; 
import { GPUBufferUsage } from '@/constants';
import type { GPUShaderConfig, UseWebGPUResource, GPURef, UseWebGPUBuffer, UseWebGPUBindGroup, ShaderSource } from '@/types/webGPU'; 

const initWebGPU = async () => {
  if (!navigator.gpu) throw new Error('WebGPU not supported');

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error('No GPU adapter found');

  const device = await adapter.requestDevice();
  if (!device) throw new Error('Failed to get GPU device');

  return device;
}

const initGPUCanvas = (device: GPUDevice, canvas?: HTMLCanvasElement) => {
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

const initGPUPipeline = (device: GPUDevice, config: GPUShaderConfig, shader: GPUShaderModule) => {
  if (config.type === 'compute') {
    return device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shader,
        entryPoint: config.entryPoint || 'main',
      }
    });
  } else if (config.type === 'render') {
    return device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shader,
        entryPoint: config.vertexEntryPoint || 'vertexMain',
      },
      fragment: {
        module: shader,
        entryPoint: config.fragmentEntryPoint || 'fragmentMain',
        targets: [null],
      },
    });
  }
}

// Helper function to get the shader code string
const getShaderCode = (source: ShaderSource): string => {
  if (typeof source === 'string') {
    return source;
  }
  return source.default;
};

interface UseWebGPUParams {
  shaderModule: ShaderSource;
  pipelineConfig: GPUShaderConfig;
  resources: Array<UseWebGPUResource>;
  workgroupSize?: Array<number>;
  canvas?: HTMLCanvasElement | null;
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
        const device = await initGPUDevice();
        gpuRef.current.device = device;
        
        // Set up context if canvas is provided
        const gpuCanvasContext = initGPUCanvas(device, canvas ?? undefined);
        gpuRef.current.context = gpuCanvasContext;

        // Create shader module
        const shader = device.createShaderModule({ code: getShaderCode(shaderModule) });

        // Create pipeline based on config type
        const pipeline = initGPUPipeline(device, pipelineConfig, shader);
        gpuRef.current.pipeline = pipeline;

        // Initialize resources
        await initializeResources(resources);

        device.addEventListener('uncapturederror', (event) => setError(event.error));

        console.log('HERE GPU IS READY');
        setGpuReady(true);
      } catch (err) {
        setError(err as GPUError);
        console.error('WebGPU initialization failed:', err);
      }
    };

    initWebGPU();

    return () => cleanup();
  }, [shaderModule]);

  const initGPUDevice = async () => {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
  
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');
  
    const device = await adapter.requestDevice();
    if (!device) throw new Error('Failed to get GPU device');
  
    return device;
  }

  const initializeResources = async (resources: Array<UseWebGPUResource>) => {
    for (const resource of resources) {
      switch (resource.type) {
        case 'buffer':
          createBuffer(resource.name, resource.payload as UseWebGPUBuffer);
          break;
        case 'bindGroup':
          createBindGroup(resource.name, resource.payload as UseWebGPUBindGroup);
          break;
        // case ResourceType.TEXTURE:
        //   createTexture(resource);
        //   break;
      }
    }
  };

  const createBuffer = (name: string, { size, data, usage }: UseWebGPUBuffer) => {
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

  const createBindGroup = (name: string, { layout, entries }: UseWebGPUBindGroup) => {
    const { device, pipeline } = gpuRef.current;
    if (!device || !pipeline) return;

    const bindGroup = device.createBindGroup({
      layout: layout || pipeline.getBindGroupLayout(0),
      entries
    });
    gpuRef.current.bindGroups.set(name, bindGroup);
    return bindGroup;
  };

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

  const dispatch = async (workgroupCount = [1, 1, 1], bindGroups: Array<GPUBindGroup> = []) => {
    if (!gpuReady) return;

    const { device, pipeline } = gpuRef.current;
    if (!device || !pipeline) return;

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    
    computePass.setPipeline(pipeline as GPUComputePipeline);
    
    bindGroups.forEach((group, index) => {
      computePass.setBindGroup(index, group);
    });
    
    computePass.dispatchWorkgroups(workgroupCount[0], workgroupCount[1], workgroupCount[2]);
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
    createBindGroup,
    // createTexture,
    cleanup
  };
};

export { useWebGPU };