import { useCallback, useEffect, useRef } from 'react';
import { computeBacklightFrame } from './colorManipulation';
import { regionConvolution } from './colorManipulation';
const videoSrc = require('./assets/videoplayback.mp4');

interface Props {}

export default function BacklightSimulator(props: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFrame = useCallback(
    (
      video: HTMLVideoElement,
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D
    ) => {
      if (video.paused) return;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const backlightFrame = computeBacklightFrame(frame);
      ctx.putImageData(backlightFrame, 0, 0);

      video.requestVideoFrameCallback(() => handleFrame(video, canvas, ctx));
    },
    []
  );

  useEffect(
    function setup() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const startFrameProcessing = () =>
        video.requestVideoFrameCallback(() => handleFrame(video, canvas, ctx));
      video.addEventListener('play', startFrameProcessing);

      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      window.addEventListener('resize', handleResize);
      handleResize();

      return () => {
        video.removeEventListener('play', startFrameProcessing);
        window.removeEventListener('resize', handleResize);
      };
    },
    [handleFrame]
  );

  return (
    <div className='main'>
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
      ></canvas>
      <video ref={videoRef} id='video' src={videoSrc} muted loop controls />
    </div>
  );
}
