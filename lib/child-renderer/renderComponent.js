import React from 'react';
import Frame from 'goblin-laboratory/widgets/frame/widget';
import Root from 'goblin-laboratory/widgets/root/index';
import {clearStylesCache} from 'goblin-laboratory/widgets/widget/index';
import {StyleSheetServer} from 'aphrodite/no-important';
import ReactDOMServer from 'react-dom/server';
import configureStore from './store.js';

function render(args) {
  const {
    widgetPath,
    props,
    labId,
    state,
    forReact = false,
    themeContext,
    currentTheme,
  } = args;

  clearStylesCache();

  let element;
  if (widgetPath) {
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
  } else {
    element = <Root store={configureStore(state)} labId={labId} />;
  }

  const {html, css} = StyleSheetServer.renderStatic(() => {
    if (forReact) {
      return ReactDOMServer.renderToString(element);
    }
    return ReactDOMServer.renderToStaticMarkup(element);
  });

  let cssContent = css.content;
  for (const element of global.document.head.childNodes) {
    if (element.tagName === 'STYLE' && element.innerHTML) {
      cssContent += element.innerHTML;
    }
  }

  return {html, css: cssContent};
}

export default function (args, next) {
  try {
    const result = render(args);
    next(null, result);
  } catch (ex) {
    next(ex);
  }
}
