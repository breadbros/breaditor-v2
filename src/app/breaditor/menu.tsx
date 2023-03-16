import React from 'react';

function Logo() {
  return (
    <svg
      viewBox="0 0 48 48"
      style={{
        width: '100%',
        height: '100%',
        // filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))"
      }}
    >
      <path
        fillRule="evenodd"
        fill="rgb(255, 255, 255)"
        transform="rotate(45 0 0) translate(11 -22)"
        d="M40.25 34.95q1.35.7 2.275-.45.925-1.15.225-2.4l-3.55-6.7-2.7 7.35Zm-10.6-2.1h3.5L38 20.75q.3-.7.225-1.375-.075-.675-.825-1.025l-4.15-1.8q-.7-.35-1.4 0t-.75 1.05Zm-14.8 0h3.45L16.9 17.6q-.05-.75-.675-1.1-.625-.35-1.475.05l-3.95 1.7q-.65.25-.725 1.125-.075.875.175 1.575Zm-7.1 2.1 3.75-2.2-2.7-7.35-3.55 6.95q-.7 1.4.3 2.275t2.2.325Zm13.55-2.1h5.35l1.65-18.2q.1-.7-.375-1.175Q27.45 13 26.75 13h-5.5q-.8 0-1.2.475-.4.475-.35 1.175ZM6.65 38q-1.95 0-3.3-1.4Q2 35.2 2 33.25q0-.6.225-1.175.225-.575.475-1.125L7.3 22q-.75-1.95-.15-3.875t2.4-2.725l4.15-1.7q.8-.3 1.625-.35.825-.05 1.525.4.4-1.6 1.6-2.675Q19.65 10 21.25 10h5.5q1.6 0 2.8 1 1.2 1 1.6 2.55.75-.3 1.55-.25.8.05 1.55.4l4.2 1.7q1.85.7 2.475 2.6.625 1.9-.225 3.7l4.6 9.2q.2.55.45 1.075.25.525.25 1.075 0 2.1-1.5 3.525Q43 38 40.9 38q-.55 0-1.025-.225-.475-.225-.975-.425l-3.05-1.5H12.1l-2.9 1.5q-.6.25-1.225.45-.625.2-1.325.2ZM24 24Z"
      />
    </svg>
  );
}

/*
function getWidgetVisibilityOptions() {
  return getCurrentPanels().reduce((obj: any, widget: any) => {
    obj[widget.title] = {
      function: () => {
        dispatch({
          type: 'SET_HIDDEN',
          widget: widget.id,
          // hidden: !this.props.hidden[widget.id],
        });
      },
      // value: !this.props.hidden[widget.id],
    };
    return obj;
  }, {});
}
*/

function getMenu(dispatch: ({}: any) => void) {
  return [
    {
      name: (
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 1,
            pointerEvents: 'none',
          }}
        >
          <Logo />
        </div>
      ),
      actions: [
        {
          type: 'actions',
          actions: {
            'Icon Thing': function () {
              console.log('I did the Icon thing');
            },
          },
        },
      ],
    },
    {
      name: 'File',
      actions: [
        {
          type: 'actions',
          actions: {
            'Open Document': () => {
              dispatch({
                type: 'DOC_OPEN_EXISTING',
              });
            },
          },
        },
      ],
    },
    {
      name: 'Test',
      actions: [
        {
          type: 'actions',
          actions: {
            'Panels on': function () {
              dispatch({type: 'TEST_ON'});
            },
            'Panels off': function () {
              dispatch({type: 'TEST_OFF'});
            },
          },
        },
      ],
    },
    {
      name: 'Help',
      actions: [
        {
          type: 'actions',
          actions: {
            About: function () {
              alert('Fuck tiled.');
              //dispatch({type: 'TEST_ON'});
            },
          },
        },
      ],
    },
    /*
    {
      name: 'Edit',
      actions: [
        {
          type: 'actions',
          actions: {
            'Edit Thing': function () {
              console.log('I did the Edit thing');
            },
          },
        },
      ],
    },
    {
      name: 'Image',
      actions: [
        {
          type: 'actions',
          actions: {
            'Image Thing': function () {
              console.log('I did the Image thing');
            },
          },
        },
      ],
    },
    {
      name: 'View',
      actions: [
        {
          type: 'actions',
          actions: {
            'View Thing': function () {
              console.log('I did the View thing');
            },
          },
        },
      ],
    },
    {
      name: 'Window',
      actions: [
        {
          type: 'actions',
          actions: {
            'New Document View': () => {
              dispatch({
                type: 'CREATE_NEW_DOCUMENT_VIEW',
              });
            },
          },
        },
        {
          type: 'bools',
          options: getWidgetVisibilityOptions(),
        },
      ],
    },
    {
      name: 'Help',
      actions: [
        {
          type: 'actions',
          actions: {
            'Help Thing': function () {
              console.log('I did the Help thing');
            },
          },
        },
      ],
    },
    */
  ];
}

export {getMenu};
