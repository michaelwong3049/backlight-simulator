struct VertexShaderOutput {

}

@vertex fn vertexMain(
  @builtin(vertex_index) vertexIndex : u32
) -> VertexShaderOutput {
  return;
}

@fragment fn fragmentMain(input: VertexShaderOutput) {
  return;
}
