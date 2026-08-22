export function connect({ url, onMessage, onClose }) {
  let ws;
  let queue = [];
  let closed = false;

  function open() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      queue.forEach((m) => ws.send(m));
      queue = [];
    };

    ws.onmessage = (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      onMessage(data);
    };

    ws.onclose = () => {
      closed = true;
      queue = [];
      if (onClose) onClose();
    };

    // A socket error is always followed by a close, so the disconnect is handled
    // there. This handler exists only to stop the error reaching window.onerror.
    ws.onerror = () => {};
  }

  open();

  return {
    send(obj) {
      if (closed) return;
      const msg = JSON.stringify(obj);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
      else queue.push(msg);
    },
  };
}
