/**
 * - A function that is used to smooth the color transition between divisions
 * @param frame is the default canvas that holds the divison width/length colors]
 * - Defines the boundaries for region convolution
 * @param startRow 
 * @param startCol 
 * @param endRow 
 * @param endCol 
 * @param kernel_size is how large your kernel convolution size is (higher = laggier but smoother transition)
 * @returns an ImageData 
 */

export function regionConvolution(
    frame: ImageData,
    startRow: number,
    startCol: number,
    endRow: number,
    endCol: number,
    kernel_size: number
): ImageData {
    const frameCopy = new Uint8ClampedArray(frame.data.length);
    for(let row = startRow; row < endRow; row++) { 
        for(let col = startCol; col < endCol; col++) {
            let currentPixel = frame.data[(row * frame.width + col) * 4];
            let red = 0, blue = 0, green = 0, alpha = 255;
            let layers = Math.floor(kernel_size / 2);

            convoluteRegion(row, col, layers, frame, endRow, startRow, red, green, blue, alpha);

            frameCopy[(currentPixel++)] = red / kernel_size * kernel_size;
            frameCopy[(currentPixel++)] = green / kernel_size * kernel_size;
            frameCopy[(currentPixel++)] = blue / kernel_size * kernel_size;
            frameCopy[(currentPixel++)] = alpha / kernel_size * kernel_size;
        }
    }

    return new ImageData(frameCopy, (endRow - startRow), (endCol - startCol))
}

function convoluteRegion(
    row: number,
    col: number, 
    layers: number, 
    frame: ImageData,
    endRow: number, 
    startRow: number,
    red: number,
    green: number,
    blue: number,
    alpha: number
) {
    for(let kernel_row = row-layers; kernel_row < row+layers+1; kernel_row++) { 
        for(let kernel_col = col-layers; kernel_col < col+layers+1; kernel_col++) {
            let currentKernelPixel = frame.data[(kernel_row * (frame.width) + kernel_col) * 4];
            // checking if we are out of the top bounds
            if(row - (layers) <= 0){
                continue;
            }

            // checking if we are out of the bottom bounds
            if(row + (layers) >= (endRow - startRow)) {
                continue;
            }
            
            red += frame.data[currentKernelPixel++]
            green += frame.data[currentKernelPixel++]
            blue += frame.data[currentKernelPixel++]
            alpha += frame.data[currentKernelPixel++]
        }
    }
}