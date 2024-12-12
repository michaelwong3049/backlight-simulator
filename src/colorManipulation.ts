/**
 * 
 * @param blurFrame This is the dimensions of the portion between the two quadrants
 * @param kernel_size This will be a number that represents ONE side (since its a square)
 * @returns new ImageData with the same width and height of the blurFrame
 */
export function regionConvolution(blurFrame: ImageData, kernel_size: number) {
    const frameCopy = new Uint8ClampedArray(blurFrame.data.length);
    for(let row = 0; row < blurFrame.height; row++) { 
        for(let col = 0; col < blurFrame.width; col++) {
            let currentPixel = (row * blurFrame.width  + col) * 4;
            let red = 0, blue = 0, green = 0, alpha = 255;
            let layers = kernel_size % 3; // represents how many times you "wrap" currentPixel; i.e. 3x3 kernel wraps once, 5x5 wraps twice, etc.
  
            // starting the kernel at the top left of the kernel
            for(let kernel_row = row - 1; kernel_row < kernel_row + 1; kernel_row++) { 
                for(let kernel_col = col - 1; kernel_col < kernel_col + 1; kernel_col++) {
                    let currentKernelPixel = (row * blurFrame.width + col) * 4;
                    // checking if we are out of the top bounds
                    if(row - (layers) < 0){
                        continue;
                    }
                    
                    // checking if we are out of the bottom bounds
                    if(row + (layers) > blurFrame.height) {
                        continue;
                    }
                    red += currentKernelPixel
                    green += currentKernelPixel++
                    blue += currentKernelPixel+2
                    alpha += currentKernelPixel+3
                }
            }

            frameCopy[(currentPixel)] = red / kernel_size**2;
            frameCopy[(currentPixel++)] = green / kernel_size**2;
            frameCopy[(currentPixel+2)] = blue / kernel_size**2;
            frameCopy[(currentPixel+3)] = alpha / kernel_size**2;
        }
    }

    return new ImageData(frameCopy, blurFrame.width, blurFrame.height)
}