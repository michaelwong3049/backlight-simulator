interface Props {
  orientation: 'vertical' | 'horizontal';
  divisions: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

export function DivisionControls(props: Props) {
  const { orientation, divisions, onIncrease, onDecrease } = props;

  return (
    <div className='division-container'>
      <p>Number of {orientation} divisions</p>
      <div className='division-controls'>
        <button onClick={onDecrease}>-</button>
        <p>{divisions}</p>
        <button onClick={onIncrease}>+</button>
      </div>
    </div>
  );
}
