import React from 'react';
import {clearStylesCache} from 'goblin-laboratory/widgets/widget/index';
import configureStore from '../store.js';
import {renderStatic} from '../renderStatic.js';

function render(args) {
  const {labId, state, forReact} = args;
  clearStylesCache();

  const Root = require('_component').default;
  const element = <Root store={configureStore(state)} labId={labId} />;
  return renderStatic(element, forReact);
}

export default function (args, next) {
  try {
    next(null, render(args));
  } catch (ex) {
    next(ex);
  }
}
