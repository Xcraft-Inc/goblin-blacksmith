import React from 'react';
import ReactPDF from '@react-pdf/renderer';

export default async function render(args) {
  const {componentPath, outputDir, props} = args;
  if (!outputDir) {
    throw new Error(`Missing outputDir argument`);
  }

  const Document = require('_component').default;
  if (!Document) {
    throw new Error(`Bad Document: ${componentPath}`);
  }
  await ReactPDF.render(<Document {...props} />, outputDir);
}
