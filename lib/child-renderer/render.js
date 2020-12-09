import setupGlobals from './setupGlobals.js';
import watt from 'watt';

delete global.window;
// Imports that must be done before setting global variables
// aphrodite uses global.window to detect if it is run in a browser
require('aphrodite/no-important');
// react-redux detects if it's run in a browser by looking at window.document.createElement
// in 'react-redux/src/utils/useIsomorphicLayoutEffect.js'
require('react-redux');
setupGlobals();

global.render = watt(function* (backend, args, next) {
  let navigator = {};
  let render;

  switch (backend) {
    case 'component': {
      navigator = args.navigator;
      render = require('./renderComponent.js').default;
      break;
    }

    case 'pdf': {
      render = require('./renderPDF.js').default;
      break;
    }
  }

  setupGlobals({navigator});
  return yield render(args, next);
});
