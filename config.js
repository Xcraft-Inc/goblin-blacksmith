'use strict';

/**
 * Retrieve the inquirer definition for xcraft-core-etc
 */
module.exports = [
  {
    type: 'list',
    name: 'renderers.component',
    message: 'List of component renderers to build',
    default: [],
  },
  {
    type: 'list',
    name: 'renderers.pdf',
    message: 'List of PDF renderers to build',
    default: [],
  },
];
