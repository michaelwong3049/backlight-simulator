import './App.css';
import { useRef, useState, useEffect, useCallback } from 'react';

function computeBacklightFrame(frame?: ImageData) {
  if (!frame) return;
  console.log(frame);
}

function App() {
  const [_, setDummyState] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // only to get the current video frame
  const contextRef = useRef<CanvasRenderingContext2D | null>();

  const handleFrame = useCallback(() => {
    // grab the current frame
    contextRef.current?.drawImage(
      videoRef.current!,
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );
    const frameData = contextRef.current?.getImageData(
      0,
      0,
      window.innerWidth,
      window.innerHeight
    );

    // handle fancy logic here
    const backlightFrame = computeBacklightFrame(frameData);
    // draw the backlight frame onto the context

    setDummyState((prev) => !prev); // hack to force rerender
    videoRef.current?.requestVideoFrameCallback(handleFrame);
  }, []);

  // runs once when the component first renders
  useEffect(
    function setup() {
      // set the context
      contextRef.current = canvasRef.current?.getContext('2d', {
        willReadFrequently: true,
      });
      videoRef.current?.addEventListener('play', () =>
        videoRef.current?.requestVideoFrameCallback(handleFrame)
      );
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
      <video
        ref={videoRef}
        id='video'
        controls
        muted
        loop
        src={require('./assets/videoplayback.mp4')}
      />
    </div>
  );
}

export default App;
