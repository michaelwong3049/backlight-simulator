# TODO 

- [ ] write to the canvas with copyExternalImageToTexture
- [ ]

# PLAN


# QUESTIONS

- the raw average of colors might be ugly. weighted color average maybe?
- maybe average is bad a formula/aggregator, most common color seen?
- how do we write the video directly to GPU?
- do we need a compute AND render shader? or is render good enough?
- how can we profile this?

# 11/18
the TODO is to figure out how to create a bind group that supports a GPUTexture...
i updated the @webgpu/types since the old version did NOT support GPUTexture type for the entries when calling
createBindGroup() function...

