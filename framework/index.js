(function (MF) {
  const { createDom, patch } = MF;

  MF.createApp = function createApp({ root, view, store, router }) {
    let oldTree = null;

    function update() {
      const newTree = view(store.getState());
      if (oldTree == null) {
        root.appendChild(createDom(newTree));
      } else {
        patch(root, newTree, oldTree, 0);
      }
      oldTree = newTree;
    }

    store.subscribe(update);

    update();
    if (router) router.start();

    return { update };
  };
})((window.MiniFramework = window.MiniFramework || {}));
