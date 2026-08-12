(function (MF) {
  MF.createStore = function createStore(initialState = {}) {
    let state = initialState;
    const listeners = [];

    function getState() {
      return state;
    }

    function setState(update) {
      const partial = typeof update === "function" ? update(state) : update;
      state = { ...state, ...partial };
      listeners.forEach((fn) => fn(state));
    }

    function subscribe(fn) {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i !== -1) listeners.splice(i, 1);
      };
    }

    return { getState, setState, subscribe };
  };
})((window.MiniFramework = window.MiniFramework || {}));
