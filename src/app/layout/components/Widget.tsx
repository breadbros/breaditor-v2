import React from 'react';

export type WidgetProps = {
  id: string;
  title: string;
};

export const Widget: React.FC<WidgetProps> = (props: WidgetProps) => {
  const {id, title} = props;

  return <div id={id}>{title}</div>;
};
