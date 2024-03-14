module.exports = function setupGlobals({navigator = {}} = {}) {
  global.document = {
    documentElement: {style: {WebkitAppearance: true}},
    attachEvent: function () {},
    createElement: function (tagName) {
      return {
        tagName: ('' + tagName).toUpperCase(),
        setAttribute: function () {},
        style: {},
      };
    },
    addEventListener: function () {},
    head: {
      childNodes: [],
      insertBefore: function (newNode) {
        global.document.head.childNodes.push(newNode);
      },
    },
  };

  global.navigator = {
    platform: '',
    userAgent: '',
    language: navigator.language || 'fr-CH',
  };

  global.window = {
    screen: {},
    location: {
      href: '',
      pathname: '',
      replace: function () {},
    },
    history: {},
    addEventListener: function () {},
    isBrowser: true,
    document: global.document,
    navigator: global.navigator,
    Date,
  };
};
