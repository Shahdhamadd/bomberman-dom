(function (MF) {
  const { addHandler, removeHandler, eventType } = MF;

  const PROPERTIES = ["value", "checked", "selected"];

  function h(tag, attrs, children) {
    if (isChild(attrs)) {
      children = attrs;
      attrs = {};
    }
    attrs = attrs || {};

    if (children == null) children = [];
    if (!Array.isArray(children)) children = [children];

    children = children
      .flat(Infinity)
      .filter((c) => c !== null && c !== undefined && c !== false && c !== true);

    return { tag, attrs, children };
  }

  function isChild(x) {
    return (
      typeof x === "string" ||
      typeof x === "number" ||
      Array.isArray(x) ||
      (x && typeof x === "object" && "tag" in x)
    );
  }

  function createDom(vnode) {
    if (typeof vnode === "string" || typeof vnode === "number") {
      return document.createTextNode(String(vnode));
    }

    const element = document.createElement(vnode.tag);
    applyAttrs(element, {}, vnode.attrs);
    for (const child of vnode.children) {
      element.appendChild(createDom(child));
    }
    return element;
  }

  function applyAttrs(element, oldAttrs, newAttrs) {
    oldAttrs = oldAttrs || {};
    newAttrs = newAttrs || {};

    for (const key in oldAttrs) {
      if (key === "key") continue;
      if (key in newAttrs) continue;
      if (key.startsWith("on")) {
        removeHandler(element, eventType(key));
      } else if (PROPERTIES.includes(key)) {
        element[key] = key === "value" ? "" : false;
      } else {
        element.removeAttribute(key === "className" ? "class" : key);
      }
    }

    for (const key in newAttrs) {
      if (key === "key") continue;
      const value = newAttrs[key];

      if (key.startsWith("on") && typeof value === "function") {
        addHandler(element, eventType(key), value);
      } else if (PROPERTIES.includes(key)) {
        if (element[key] !== value) element[key] = value;
      } else if (key === "class" || key === "className") {
        const cls = value == null ? "" : String(value);
        if (element.getAttribute("class") !== cls) element.setAttribute("class", cls);
      } else if (key === "style" && typeof value === "object") {
        element.removeAttribute("style");
        Object.assign(element.style, value);
      } else if (value === false || value == null) {
        element.removeAttribute(key);
      } else if (value === true) {
        element.setAttribute(key, "");
      } else if (element.getAttribute(key) !== String(value)) {
        element.setAttribute(key, value);
      }
    }
  }

  function patch(parent, newVNode, oldVNode, index = 0) {
    const existing = parent.childNodes[index];

    if (oldVNode == null && newVNode == null) return;

    if (oldVNode == null) {
      parent.appendChild(createDom(newVNode));
      return;
    }

    if (newVNode == null) {
      if (existing) parent.removeChild(existing);
      return;
    }

    if (changed(newVNode, oldVNode)) {
      parent.replaceChild(createDom(newVNode), existing);
      return;
    }

    patchNode(existing, newVNode, oldVNode);
  }

  function patchNode(dom, newVNode, oldVNode) {
    if (typeof newVNode !== "object") return;
    applyAttrs(dom, oldVNode.attrs, newVNode.attrs);
    patchChildren(dom, newVNode.children, oldVNode.children);
  }

  function patchChildren(parent, newChildren, oldChildren) {
    if (hasKeys(newChildren) || hasKeys(oldChildren)) {
      patchKeyed(parent, newChildren, oldChildren);
    } else {
      patchByIndex(parent, newChildren, oldChildren);
    }
  }

  function patchByIndex(parent, newChildren, oldChildren) {
    const common = Math.min(newChildren.length, oldChildren.length);

    for (let i = 0; i < common; i++) {
      patch(parent, newChildren[i], oldChildren[i], i);
    }
    for (let i = oldChildren.length; i < newChildren.length; i++) {
      parent.appendChild(createDom(newChildren[i]));
    }
    for (let i = oldChildren.length - 1; i >= newChildren.length; i--) {
      if (parent.childNodes[i]) parent.removeChild(parent.childNodes[i]);
    }
  }

  function patchKeyed(parent, newChildren, oldChildren) {
    const oldByKey = new Map();
    oldChildren.forEach((vnode, i) => {
      const key = keyOf(vnode);
      if (key != null) oldByKey.set(key, { node: parent.childNodes[i], vnode });
    });

    newChildren.forEach((newChild, i) => {
      const key = keyOf(newChild);
      const match = key != null ? oldByKey.get(key) : null;

      let node;
      if (match && !changed(newChild, match.vnode)) {
        patchNode(match.node, newChild, match.vnode);
        node = match.node;
      } else {
        node = createDom(newChild);
      }

      const current = parent.childNodes[i];
      if (current !== node) parent.insertBefore(node, current || null);
    });

    while (parent.childNodes.length > newChildren.length) {
      parent.removeChild(parent.childNodes[parent.childNodes.length - 1]);
    }
  }

  function keyOf(vnode) {
    return vnode && typeof vnode === "object" && vnode.attrs && vnode.attrs.key != null
      ? vnode.attrs.key
      : null;
  }

  function hasKeys(children) {
    return children.some((c) => keyOf(c) != null);
  }

  function changed(a, b) {
    if (typeof a !== typeof b) return true;
    if (typeof a === "string" || typeof a === "number") return String(a) !== String(b);
    return a.tag !== b.tag;
  }

  MF.h = h;
  MF.createDom = createDom;
  MF.patch = patch;
})((window.MiniFramework = window.MiniFramework || {}));
