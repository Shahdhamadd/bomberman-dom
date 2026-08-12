(function (MF) {
  MF.addHandler = function addHandler(element, type, handler) {
    element["on" + type] = handler;
  };

  MF.removeHandler = function removeHandler(element, type) {
    element["on" + type] = null;
  };

  MF.eventType = function eventType(attrKey) {

    return attrKey.slice(2).toLowerCase();
  };
})((window.MiniFramework = window.MiniFramework || {}));
