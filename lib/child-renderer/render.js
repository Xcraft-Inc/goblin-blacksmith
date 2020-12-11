import setupGlobals from './setupGlobals.js';
import watt from 'gigawatts';

delete global.window;
// Imports that must be done before setting global variables
// aphrodite uses global.window to detect if it is run in a browser
require('aphrodite/no-important');
// react-redux detects if it's run in a browser by looking at window.document.createElement
// in 'react-redux/src/utils/useIsomorphicLayoutEffect.js'
require('react-redux');
setupGlobals();

global.render = watt(function* (backend, args) {
  let navigator = args.navigator || {};
  setupGlobals({navigator});

  switch (backend) {
    case 'component': {
      return require('./renderComponent.js').default(args);
    }

    case 'pdf': {
      return yield require('./renderPDF.js').default(args);
    }
  }
});
