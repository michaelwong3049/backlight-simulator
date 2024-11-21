import React, { useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import { useRef, useState } from 'react'

interface Dimensions {
  h: number;
  w: number;
}

function computeFrame() {
  
}

function App() {
  const [videoDimensions, setVideoDimensions] = useState<Dimensions>({ h: 0, w: 0 })
  const [canvasDimensions, setCanvasDimensions] = useState<Dimensions>({ h: 0, w: 0})
  const [counter, setCounter] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const ctx = canvasRef.current?.getContext('2d');

  console.log(canvasDimensions);
  console.log(window.innerHeight, window.innerWidth)

  const setAllDimensions = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const videoRect = videoRef.current.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();
    setVideoDimensions({ h: videoRect.height, w: videoRect.width})
    // setCanvasDimensions({ h: window.innerHeight, w: window })
    setCanvasDimensions({ h: canvasRect.height, w: canvasRect.width })
  }

  // runs once when the component first renders
  useEffect(function setup(){
    setAllDimensions()
    
    window.addEventListener('resize', () => {
      setAllDimensions()
    });

    videoRef.current?.addEventListener('play', () =>
      videoRef.current?.requestVideoFrameCallback(updateCanvas)
    ); 
  }, []);

  videoRef.current?.requestVideoFrameCallback(updateCanvas);
  function updateCanvas() {
    // ctx?.drawImage(videoRef.current!, 0, 0, width, height);
    setCounter((counter) => counter+1);
  }

  if (ctx) {
    ctx.canvas.width = canvasDimensions.w;
    ctx.canvas.height = canvasDimensions.h
  }
  // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
  ctx?.drawImage(
    videoRef.current!,
    0, 0,
     videoDimensions.w,videoDimensions.h,
    0, 0,
     canvasDimensions.w,canvasDimensions.h,
  );

  return (
    <div className="main"
   >
      <canvas id="canvas" 
       ref={canvasRef}
      // width={canvasDimensions.w}
      // height={canvasDimensions.h}
      ></canvas>
      <video
        ref={videoRef}
        id="video"
        controls
        muted
        loop
        src={require('./assets/videoplayback.mp4')}
        />
    </div>
  );
}

export default App;
