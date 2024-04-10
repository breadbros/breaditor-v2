import React, {useEffect, useState} from 'react';

// @ts-ignore
import css from './InputScalar.module.css';

interface InputScalarProps {
  onChange: (val: number) => void;
  value: number;
  min: number;
  max: number;
  unit: string;

  name: string;
}

const InputScalar: React.FC<InputScalarProps> = (props) => {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    function onPointerUp() {
      setDragging(false);
      document.exitPointerLock();
    }

    function onPointerMove(e: MouseEvent) {
      e.preventDefault();
      props.onChange(
        Math.min(Math.max(props.value + e.movementX, props.min), props.max),
      );
    }
    if (dragging) {
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      return () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };
    }
  }, [props.value, dragging, props]);

  function handleChange(e: any) {
    console.log('CHANGING');
    // @ts-ignore
    props.onChange(Math.min(Math.max(e.target.value, props.min), props.max));
  }

  return (
    <div className={css.propertyControl}>
      <div
        className={css.label}
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
          // @ts-ignore
          e.target.requestPointerLock();
        }}
      >
        {props.name}:
      </div>

      <div style={{position: 'relative', height: 26}}>
        <input
          name={props.name}
          type="text"
          className={css.input}
          style={{backgroundColor: 'rgba(0,0,0,0.25)'}}
          value={props.value}
          onChange={handleChange}
          onClick={(e) => {
            // @ts-ignore
            e.target.select();
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 16,
            // height: "100%",
            lineHeight: '26px',
            top: 0,
            right: 8,
            color: 'gray',
            pointerEvents: 'none',
          }}
        >
          {props.unit}
        </div>
      </div>
    </div>
  );
};

export {InputScalar};
