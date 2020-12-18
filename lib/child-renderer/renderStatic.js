import {StyleSheetServer} from 'aphrodite/no-important';
import ReactDOMServer from 'react-dom/server';

export function renderStatic(element, forReact = false) {
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
