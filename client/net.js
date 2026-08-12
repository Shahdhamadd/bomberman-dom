export function connect({ url, onMessage, onOpen, onClose }) {
  let ws;
  let queue = [];

  function open() {
    ws = new WebSocket(url);

    ws.onopen = () => {
      queue.forEach((m) => ws.send(m));
      queue = [];
      if (onOpen) onOpen();
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
      if (onClose) onClose();
    };

    ws.onerror = () => {};
  }

  open();

  return {
    send(obj) {
      const msg = JSON.stringify(obj);
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
      else queue.push(msg);
    },
  };
}
