'use strict';

/**
 * Retrieve the inquirer definition for xcraft-core-etc
 */
module.exports = [
  {
    type: 'input',
    name: 'outputDir',
    message: 'output directory name',
    default: 'blacksmith',
  },
  {
    type: 'list',
    name: 'renderers.component',
    message: 'List of component renderers to build',
    default: [],
  },
  {
    type: 'list',
    name: 'renderers.root',
    message: 'List of root renderers to build',
    default: [],
  },
  {
    type: 'list',
    name: 'renderers.pdf',
    message: 'List of PDF renderers to build',
    default: [],
  },
];
