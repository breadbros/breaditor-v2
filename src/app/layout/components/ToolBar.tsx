import React from 'react';
// @ts-ignore
import css from './ToolBar.module.css';

import {TOOLS} from '../../breaditor/tools/constants';
import * as icons from '../../ui/icons';

interface ToolBarProps {
  dispatch: ({}: any) => void;
  selected: {};
  undo?: {};
  redo?: {};
}

const ToolBar: React.FC<ToolBarProps> = (props) => {
  const tools = [
    {id: TOOLS.Brush, icon: icons.BrushIcon, name: 'Brush'},
    // { id: TOOLS.Pencil, icon: icons.PencilIcon, name: "Pencil" },
    // { id: TOOLS.Eraser, icon: icons.EraserIcon, name: "Eraser" },
    // { id: TOOLS.Dither, icon: icons.DitherIcon, name: "Dither" },
    // { id: TOOLS.SelectRect, icon: icons.SelectRectIcon, name: "Select Rect" },
    {id: TOOLS.Pan, icon: icons.HandIcon, name: 'Pan'},
    // { id: TOOLS.Line, icon: icons.LineIcon, name: "Line" },
    // { id: TOOLS.Fill, icon: icons.BucketIcon, name: "Fill" },
    {id: TOOLS.Eyedropper, icon: icons.EyedropperIcon, name: 'Eyedropper'},
    {id: TOOLS.Zoom, icon: icons.ZoomIcon, name: 'Zoom'},
  ];
  return (
    <div className={css.container}>
      <div className={css.tools}>
        {tools.map((tool, i) => {
          return (
            <Button
              key={i}
              icon={tool.icon}
              selected={props.selected === tool.id}
              name={tool.name}
              onClick={() =>
                props.dispatch({type: 'TOOL_SELECT', value: tool.id})
              }
              marginBottom={i === tools.length - 1 ? 0 : 4}
              marginRight={0}
            />
          );
        })}
      </div>
    </div>
  );
};

interface ButtonProps {
  marginRight: number;
  marginBottom: number;
  selected: boolean;
  icon: any; // what's the type of the Svg Icons?
  name: string;
  v?: number;
  onClick?: ({}: any) => void;
}

// function Button({marginRight, marginBottom, icon, v, selected, onClick, name}) {
const Button: React.FC<ButtonProps> = (props) => {
  let IconComponent = props.icon;
  return (
    <div
      className={`button ${css.button} ${props.selected ? 'selected' : ''}`}
      style={{
        marginBottom: props.marginBottom,
        marginRight: props.marginRight,
      }}
      onClick={props.onClick}
    >
      <IconComponent
        style={{
          fill: 'white',
        }}
        v={props.v ? props.v : 0}
      />
    </div>
  );
};

export {ToolBar};
