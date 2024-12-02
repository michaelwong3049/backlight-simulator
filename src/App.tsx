import './App.css';
import { useRef, useState, useEffect, useCallback } from 'react';

function App() {
  const [_, setDummyState] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // const contextRef = useRef<CanvasRenderingContext2D>( ?? null);
  const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });

  const calculate_kernel = useCallback(() => {
    const frame = ctx?.getImageData(0, 0, window.innerHeight, window.innerWidth);
    console.log(ctx)
    const data = frame?.data;
    if(frame){
      for(let i = 0; i < frame?.height; i++){
        for(let j = 0; j < frame?.width; j++){
          console.log(data) 
        }
      }
    }
  }, [ctx])

  const rerender = useCallback(() => {
    console.log("------ New Frame ------")
    ctx?.drawImage(videoRef.current!, 0, 0);
    calculate_kernel()
    console.log('hi')
    videoRef.current?.requestVideoFrameCallback(rerender);
    setDummyState((prevState) => !prevState);
  }, [calculate_kernel, ctx]);

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
