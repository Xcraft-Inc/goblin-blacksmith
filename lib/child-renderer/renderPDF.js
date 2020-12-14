import watt from 'gigawatts';
import React from 'react';
import ReactPDF from '@react-pdf/renderer';

try {
  require('yoga-layout-prebuilt/build/Release/nbind.node');
} catch (ex) {
  if (ex.code !== 'MODULE_NOT_FOUND') {
    throw ex;
  }
}

export default watt(function* render(args, next) {
  const {componentPath, outputDir, props} = args;
  if (!outputDir) {
    throw new Error(`Missing outputDir argument`);
  }

  const Document = require('_component').default;
  if (!Document) {
    throw new Error(`Bad Document: ${componentPath}`);
  }
  yield ReactPDF.render(<Document {...props} />, outputDir, () => next());
});
