require('v8-compile-cache');
const watt = require('gigawatts');

try {
  require('./setupGlobals.js')();

  process.on(
    'message',
    watt(function* (msg) {
      const {requestId, backend, args} = msg;
      console.log('rendering...');

      let result;
      try {
        require(args.renderIndex);
        delete args.renderIndex;
        const {render} = global;
        result = yield render(backend, args);
      } catch (err) {
        process.send({
          requestId,
          error: {
            name: err.name,
            message: err.message,
            stack: err.stack,
          },
        });
        return;
      }

      console.log('rendering done');

      process.send({
        requestId,
        result,
      });
    })
  );

  process.send({
    started: true,
  });
} catch (err) {
  process.send({
    started: false,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
  });
  throw err;
}
