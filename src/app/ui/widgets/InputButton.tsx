import React from 'react';

// @ts-ignore
import css from './InputButton.module.css';

interface InputButtonProps {
  selected: boolean;
  name: string;
  onClick: (arg: any) => void;
  style: any;
  icon: any;
}

const InputButton: React.FC<InputButtonProps> = (props) => {
  return (
    <div className={css.propertyControl} title={props.name}>
      <div
        onClick={props.onClick}
        style={props.style}
        className={`button ${props.selected ? 'selected' : ''}`}
      >
        {props.icon ? props.icon : props.name}
      </div>
    </div>
  );
};

export {InputButton};
