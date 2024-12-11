import { useEffect, useRef, useState } from 'react';
import './App.css';
import BacklightSimulator from './BacklightSimulator';

interface Dimensions {
  width: number;
  height: number;
}

function App() {
  // defaults taken from my local machine lol
  const [backlightDimensions, setBacklightDimensions] = useState<Dimensions>({
    width: 149,
    height: 879,
  });
  const backlightContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const backlightContainer = backlightContainerRef.current;
    if (!backlightContainer) return;

    const handleResize = () =>
      setBacklightDimensions({
        width: backlightContainer.clientWidth,
        height: backlightContainer.clientHeight,
      });
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div id='content-root'>
      <div id='backlight-container' ref={backlightContainerRef}>
        <BacklightSimulator
          width={backlightDimensions.width}
          height={backlightDimensions.height}
        />
      </div>
      <button>hello world</button>
    </div>
  );
}

export default App;
