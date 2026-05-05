import { GPUEngineBuffer } from "./engines/GPUEngine";

export const RED_CHANNEL_OFFSET = 0;
export const GREEN_CHANNEL_OFFSET = 1;
export const BLUE_CHANNEL_OFFSET = 2;
export const ALPHA_CHANNEL_OFFSET = 3;

// export const GPUBufferUsage = Object.freeze({
//   MAP_READ: 0x0001,
//   MAP_WRITE: 0x0002,
//   COPY_SRC: 0x0004,
//   COPY_DST: 0x0008,
//   INDEX: 0x0010,
//   VERTEX: 0x0020,
//   UNIFORM: 0x0040,
//   STORAGE: 0x0080,
//   INDIRECT: 0x0100,
//   QUERY_RESOLVE: 0x0200
// } as const);
// export type GPUBufferUsage = typeof GPUBufferUsage[keyof typeof GPUBufferUsage];
//
// export const GPUColorWrite = Object.freeze({
//   RED: 0x1,
//   GREEN: 0x2,
//   BLUE: 0x4,
//   ALPHA: 0x8,
//   ALL: 0xF
// } as const);
// export type GPUColorWrite = typeof GPUColorWrite[keyof typeof GPUColorWrite];
//
// export const GPUMapMode = Object.freeze({
//   READ: 0x0001,
//   WRITE: 0x0002
// } as const);
// export type GPUMapMode = typeof GPUMapMode[keyof typeof GPUMapMode];
//
// export const GPUShaderStage = Object.freeze({
//   VERTEX: 0x1,
//   FRAGMENT: 0x2,
//   COMPUTE: 0x4
// } as const);
// export type GPUShaderStage = typeof GPUShaderStage[keyof typeof GPUShaderStage];
//
//
// export const GPUTextureUsage = Object.freeze({
//   COPY_SRC: 0x01,
//   COPY_DST: 0x02,
//   TEXTURE_BINDING: 0x04,
//   STORAGE_BINDING: 0x08,
//   RENDER_ATACHMENT: 0x10
// } as const);
//
// export type GPUTextureUsage = typeof GPUTextureUsage[keyof typeof GPUTextureUsage];
//
//
export const GPU_BUFFERS: Array<GPUEngineBuffer> = [
  {
    name: 'settingsBuffer', // TODO: this buffer is for ...
    label: "settingsBuffer - label",
    // TODO(michaelwong): fix to match the size in bytes of params
    sizeInBytes: 24, 
    usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE
  }
]

