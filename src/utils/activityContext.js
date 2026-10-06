const { AsyncLocalStorage } = require('async_hooks');

const context = new AsyncLocalStorage();

function markActivityLogged() {
  const state = context.getStore();
  if (state) state.recorded = true;
}

function runActivityContext(state, callback) {
  return context.run(state, callback);
}

module.exports = { markActivityLogged, runActivityContext };
