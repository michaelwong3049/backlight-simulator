interface Coordinates {
    first_pixel_coordinate: number;
    last_pixel_coordinate: number;
}

export function regionConvolution(frame: ImageData, region: Coordinates, kernel_size: number) {
    const frameCopy = new Uint8ClampedArray(region.last_pixel_coordinate - region.first_pixel_coordinate)
    for(let i = region.first_pixel_coordinate; i < region.last_pixel_coordinate; i+=4) {
        let currentPixel = frame.data.slice(i, i+4);

        let red = 0, green = 0, blue = 0, alpha = 255;

        
        
        let top_left, top_middle, top_right;
        try {
            top_left = currentPixel.slice(i-frame.width-4, i-frame.width);
            top_middle = currentPixel.slice(i-frame.width, i-frame.width+4);
            top_right = currentPixel.slice(i-frame.width+4, i-frame.width+8);
        } catch {
            const black = new Uint8ClampedArray([0,0,0,255])
            top_left = black;
            top_middle = black;
            top_right = black;
        }
        let middle_left = currentPixel.slice(i-4, i);
        let middle_right = currentPixel.slice(i+4, i+8);
        let bot_left = currentPixel.slice(i+frame.width-4, i+frame.width);
        let bot_middle = currentPixel.slice(i+frame.width, i+frame.width+4);
        let bot_right = currentPixel.slice(i+frame.width+4, i+frame.width+8);

        let surroundingPixels = [top_left, top_middle, top_right, middle_left, currentPixel, middle_right, bot_left, bot_middle, bot_right]
        for(let pixel = 0; pixel < surroundingPixels.length; pixel++) {
            red += surroundingPixels[pixel][0]
            green += surroundingPixels[pixel][1]
            blue += surroundingPixels[pixel][2]
            alpha += surroundingPixels[pixel][3]
        }

        frameCopy[i] = red
        frameCopy[i+1] = blue
        frameCopy[i+2] = green
        frameCopy[i+3] = alpha
    }
    
    return new ImageData(frameCopy, frame.width, frame.height)
}