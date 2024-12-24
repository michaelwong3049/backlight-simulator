import { useEffect, useRef, useState } from 'react';
import '@/styles/App.css';
import BacklightSimulator from '@/components/BacklightSimulator';
import { DivisionControls } from '@/components/DivisionControls';
import type { Dimensions } from '@/types';

function App() {
  const [horizontalDivisions, setHorizontalDivisions] = useState(3);
  const [verticalDivisions, setVerticalDivisions] = useState(3);
  const [backlightDimensions, setBacklightDimensions] = useState<Dimensions>({
    // defaults taken from my local machine lol
    width: 1497,
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
          horizontalDivisions={horizontalDivisions}
          verticalDivisions={verticalDivisions}
        />
      </div>
      <div id='backlight-controls'>
        <DivisionControls
          orientation='vertical'
          divisions={verticalDivisions}
          onIncrease={() => setVerticalDivisions((num) => num + 1)}
          onDecrease={() => setVerticalDivisions((num) => num - 1)}
        />
        <DivisionControls
          orientation='horizontal'
          divisions={horizontalDivisions}
          onIncrease={() => setHorizontalDivisions((num) => num + 1)}
          onDecrease={() => setHorizontalDivisions((num) => num - 1)}
        />
      </div>
    </div>
  );
}

export default App;
