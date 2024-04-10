import React from 'react';

// @ts-ignore
export default function ({style}) {
  return [
    <svg
      viewBox="0 0 4 4"
      width="4px"
      height="4px"
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <path
        fillRule="evenodd"
        d="M-0.000,4.000 L-0.000,3.000 L1.000,3.000 L1.000,2.000 L2.000,2.000 L2.000,1.000 L3.000,1.000 L3.000,-0.000 L4.000,-0.000 L4.000,1.000 L4.000,2.000 L4.000,3.000 L4.000,4.000 L-0.000,4.000 Z"
      />
    </svg>,
    <svg
      viewBox="0 0 4 4"
      width="4px"
      height="4px"
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <path
        fillRule="evenodd"
        d="M3.000,1.000 L3.000,2.000 L2.000,2.000 L2.000,3.000 L1.000,3.000 L1.000,4.000 L-0.000,4.000 L-0.000,3.000 L-0.000,2.000 L-0.000,1.000 L-0.000,-0.000 L4.000,-0.000 L4.000,1.000 L3.000,1.000 Z"
      />
    </svg>,
    <svg
      viewBox="0 0 4 4"
      width="4px"
      height="4px"
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <path
        fillRule="evenodd"
        d="M3.000,1.000 L3.000,-0.000 L4.000,-0.000 L4.000,1.000 L3.000,1.000 ZM2.000,2.000 L2.000,1.000 L3.000,1.000 L3.000,2.000 L2.000,2.000 ZM1.000,3.000 L1.000,2.000 L2.000,2.000 L2.000,3.000 L1.000,3.000 ZM-0.000,4.000 L-0.000,3.000 L1.000,3.000 L1.000,4.000 L-0.000,4.000 Z"
      />
    </svg>,
  ][2];
}
