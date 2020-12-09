import watt from 'gigawatts';
import React from 'react';
import ReactPDF from '@react-pdf/renderer';

export default watt(function* render(args, next) {
  const {documentPath, outputDir, props} = args;
  if (!outputDir) {
    throw new Error(`Missing outputDir argument`);
  }

  const Document = require('_component').default;
  if (!Document) {
    throw new Error(`Bad Document: ${documentPath}`);
  }
  yield ReactPDF.render(<Document {...props} />, outputDir, () => next());
});
