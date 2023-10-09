import React from 'react';
import Frame from 'goblin-laboratory/widgets/frame/widget';
import {clearStylesCache} from 'goblin-laboratory/widgets/widget/style/build-style.js';
import configureStore from '../store.js';
import {renderStatic} from '../renderStatic.js';

function render(args) {
  const {
    props,
    labId,
    state,
    forReact = false,
    themeContext,
    currentTheme,
  } = args;
  clearStylesCache();

  let element;
  const Widget = require('_component').default;
  if (state) {
    element = (
      <Frame
        labId={labId}
        store={configureStore(state)}
        currentTheme={currentTheme}
        themeContext={themeContext}
      >
        <Widget {...props} />
      </Frame>
    );
  } else {
    element = <Widget {...props} />;
  }

  return renderStatic(element, forReact);
}

export default function (args, next) {
  try {
    next(null, render(args));
  } catch (ex) {
    next(ex);
  }
}
