import './App.css';
import { useRef, useState, useEffect, useCallback } from 'react';

function App() {
  const [_, setDummyState] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const ctx = canvasRef.current?.getContext('2d');

  const rerender = useCallback(() => {
    setDummyState((prevState) => !prevState);
    videoRef.current?.requestVideoFrameCallback(rerender);
  }, []);

  // runs once when the component first renders
  useEffect(
    function setup() {
      videoRef.current?.addEventListener('play', () =>
        videoRef.current?.requestVideoFrameCallback(rerender)
      );
    },
    [rerender]
  );

  if (videoRef.current) {
    ctx?.drawImage(videoRef.current, 0, 0);
  }

  return (
    <div className='main'>
      <canvas
        id='canvas'
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
