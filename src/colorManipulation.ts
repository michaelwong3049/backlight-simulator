type Kernel = Array<Array<number>>;
/**
 * CODE PLAN
 * 
 * - react component will call `computeBacklightFrame` and slap the result
 * right onto the canvas
 * 
 * HOW TO GET THE BACKLIGHT
 * 
 * - we need a convolution kernel
 *  - write a convolution function to access the location to get the surrounding pixel data colors
 *  - solve convolution border problem (symmetric [left side = left border, top = top, top-left = average of left and top?])
 *  - now we have to find the locations of each of the pixels by traversal (n * m)
 *  - reutnr image data obj
 */

/**
 * This function takes in a video frame ImageData object, performs
 * some internal calculations and returns the ImageData the canvas
 * should display.
 * 
 * 
 * 
 * 
 * @param frame - video data that matches the size of the canvas
 */
export function computeBacklightFrame(frame: ImageData): ImageData {

    const convolve = (kernel: Kernel) => {
        /**
         * - traverse the frame data 
         * - use a window of 4 to get each pixel data
         * - perform the kernel calculations on that pixel data 
         * - save to a new uint array thing 
         * - return array
         */

        const result = [];

        for(let i = 0; i < frame.data.length; i +=4) {
            const currentPixel = frame.data.slice(i, i+4);
            /**
             * check if currentPixel is on the borders
             * if it is: then we have to change the kernel
             * if not {
             *   - average of all the surrounding pixels + currentPixel 
             *   - set that to the convoludedPixel
             * }
             * 
             * ** imagine we are the 1st row 1st col pixel in a 2d matrix
             * top-left = currentPixel - length of the frame.data.width - 4
             * top-middle = currentPixel - length of the frame.data.width +4
             * top-right = currentPixel - lenght of the frame.data.width + 8
             * middle-left = currentPixel - 4
             * middle-right = currentPixel +4
             * bottom-ledft = currentPixel + length of the frame.data.width -4
             * bottom-middle = currentPixel + lenght of hte frame.data.width +4
             * bottom-right = currentPixel + lenght of hte frame.data.width + 8
             * 
             * const red  }
             * const green  }  = create somee type of sum and add it from each pixel and then to get the asverage we would divide it by 9, giving us the convoluded pixel 
             * const blue }
             */

            let red = 0, green = 0, blue = 0, alpha = 0
            let top_left = currentPixel.slice(i-frame.width-4, i-frame.width);
            let top_middle = currentPixel.slice(i-frame.width, i-frame.width+4);
            let top_right = currentPixel.slice(i-frame.width+4, i-frame.width+8);
            let middle_left = currentPixel.slice(i-4, i);
            let middle_right = currentPixel.slice(i+4, i+8);
            let bot_left = currentPixel.slice(i+frame.width-4, i+frame.width);
            let bot_middle = currentPixel.slice(i+frame.width, i+frame.width+4);
            let bot_right = currentPixel.slice(i+frame.width+4, i+frame.width+8);
            const black = new Uint8ClampedArray([0,0,0,0])
            if(i-frame.width-4 < 0) {
                top_left = black;
                top_middle = black;
                top_right = black;
            } else if(i+frame.width-4 > frame.data.length) {
                bot_left = black;
                bot_middle = black;
                bot_right = black;
            }
            const kernel_pixels = [top_left, top_middle, top_right, middle_left, currentPixel, middle_right, bot_left, bot_middle, bot_right];
            for(let pixel = 0; pixel < kernel_pixels.length; pixel++) {
                for(let value = 0; value < 4; value++) {
                    red += kernel_pixels[pixel][value]
                    blue += kernel_pixels[pixel][value]
                    green += kernel_pixels[pixel][value]
                    alpha += kernel_pixels[pixel][value]
                }
            }

            const convoludedPixel = [red/9,blue/9,green/9,alpha/9] //should round them later
            result.push(...convoludedPixel);
        }

        return new ImageData(new Uint8ClampedArray(result), frame.height, frame.width);
    }

    return convolve(kernel);
};

const kernel = [
  [1/9, 1/9, 1/9],
  [1/9, 1/9, 1/9],
  [1/9, 1/9, 1/9]
];