(function (MF) {
  MF.createRouter = function createRouter(routes = {}, options = {}) {
    if (typeof routes !== "object" || routes === null || Array.isArray(routes)) {
      throw new TypeError("createRouter: routes must be an object mapping paths to functions");
    }
    for (const path in routes) {
      if (typeof routes[path] !== "function") {
        throw new TypeError(
          `createRouter: handler for "${path}" must be a function, got ${typeof routes[path]}`
        );
      }
    }

    const notFound = options.notFound;
    if (notFound !== undefined && typeof notFound !== "function") {
      throw new TypeError("createRouter: options.notFound must be a function");
    }

    function currentPath() {
      return window.location.hash.slice(1) || "/";
    }

    function handle() {
      const path = currentPath();
      const handler = routes[path] || notFound;
      if (handler) handler(path);
    }

    function navigate(path) {
      if (typeof path !== "string") {
        throw new TypeError(`navigate: path must be a string, got ${typeof path}`);
      }
      window.location.hash = path;
    }

    function start() {
      window.onhashchange = handle;
      handle();
    }

    function stop() {
      window.onhashchange = null;
    }

    return { start, stop, navigate, currentPath };
  };
})((window.MiniFramework = window.MiniFramework || {}));
