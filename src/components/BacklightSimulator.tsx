import { useCallback, useEffect, useRef } from 'react';
import {
  computeBacklightFrame,
  regionConvolution,
} from '@/utils/colorManipulation';
const videoSrc = require('@/assets/videoplayback.mp4');

interface Props {
  width: number;
  height: number;
  horizontalDivisions: number;
  verticalDivisions: number;
}

export default function BacklightSimulator(props: Props) {
  const { width, height, horizontalDivisions, verticalDivisions } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFrame = useCallback(
    (
      video: HTMLVideoElement,
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      horizontalDivisions: number,
      verticalDivisions: number
    ) => {
      if (video.paused) return;

      ctx.clearRect(0, 0, width, height);
      // TODO: if we're only calculating divisions, we may not need to draw the whole image...
      // TODO: we could even potentially use an offscreen canvas to save on render times
      ctx.drawImage(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight,
        0,
        0,
        width,
        height
      );

      const frame = ctx.getImageData(0, 0, width, height);
      const backlightFrame = computeBacklightFrame(
        ctx,
        frame,
        { width: video.offsetWidth, height: video.offsetHeight },
        {
          horizontalDivisions,
          verticalDivisions,
        }
      );
      // ctx.putImageData(backlightFrame, 0, 0);

      video.requestVideoFrameCallback(() =>
        handleFrame(video, canvas, ctx, horizontalDivisions, verticalDivisions)
      );
    },
    [height, width]
  );

  useEffect(
    function setup() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      // NOTE: we can disable alpha channel here which should save comp time
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const startFrameProcessing = () =>
        video.requestVideoFrameCallback(() =>
          handleFrame(
            video,
            canvas,
            ctx,
            horizontalDivisions,
            verticalDivisions
          )
        );
      video.addEventListener('play', startFrameProcessing);

      const handleResize = () => {
        canvas.width = width;
        canvas.height = height;
      };
      window.addEventListener('resize', handleResize);
      handleResize();

      return () => {
        video.removeEventListener('play', startFrameProcessing);
        window.removeEventListener('resize', handleResize);
      };
    },
    [handleFrame, height, width, horizontalDivisions, verticalDivisions]
  );

  // TODO: we can move these styles into css later
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <canvas ref={canvasRef} width={width} height={height}></canvas>
      <video ref={videoRef} id='video' src={videoSrc} muted loop controls />
    </div>
  );
}
