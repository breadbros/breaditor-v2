import React from 'react';
// @ts-ignore
import * as icons from '../../ui/icons';
// @ts-ignore
import css from './TestPanel.module.css';

interface TestPanelProps {
  id: string;
  title: string;
  text: string;
}

const TestPanel: React.FC<TestPanelProps> = (props) => {
  return <div className={css.container}>{props.text}</div>;
};

export {TestPanel};
