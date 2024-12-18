export function regionConvolution(
    startRow: number,
    endRow: number,
    startCol: number,
    endCol: number,
    kernel_size: number
): ImageData {
    const frameCopy = new Uint8ClampedArray((endRow - startRow) * (endCol - startCol));
    for(let row = startRow; row < endRow; row++) { 
        for(let col = startCol; col < endCol; col++) {
            let currentPixel = (row * (endCol - col) + col) * 4;
            let red = 0, blue = 0, green = 0, alpha = 255;
            let layers = kernel_size / 2;

            // starting the kernel at the top left of the kernel
            for(let kernel_row = row-Math.floor(layers); kernel_row < kernel_row+Math.ceil(layers); kernel_row++) { 
                for(let kernel_col = col-Math.floor(layers); kernel_col < kernel_col+Math.ceil(layers); kernel_col++) {
                    let currentKernelPixel = (row * (endCol - startCol) + col) * 4;
                    // checking if we are out of the top bounds
                    if(row - (Math.floor(layers)) < 0){
                        continue;
                    }
                    
                    // checking if we are out of the bottom bounds
                    if(row + (Math.ceil(layers)) > (endRow - startRow)) {
                        continue;
                    }
                    red += currentKernelPixel
                    green += currentKernelPixel++
                    blue += currentKernelPixel+2
                    alpha += currentKernelPixel+3
                }
            }

            frameCopy[(currentPixel++)] = red / kernel_size * kernel_size;
            frameCopy[(currentPixel++)] = green / kernel_size * kernel_size;
            frameCopy[(currentPixel++)] = blue / kernel_size * kernel_size;
            frameCopy[(currentPixel++)] = alpha / kernel_size * kernel_size;
        }
    }

    return new ImageData(frameCopy, (endRow - startRow), (endCol - startCol))
}