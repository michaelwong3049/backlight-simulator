declare module '*.wgsl' {
  const content: string & { __wgsl: never };
  export default content;
}