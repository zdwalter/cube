var util = require("util"),
    websocket = require("websocket");

module.exports = function(protocol, host, port) {
  var types = {},
      queue = [],
      url = protocol + "//" + host + ":" + port + "/1.0/types/get",
      socket,
      timeout,
      closing,
      reply = null;

  function close() {
    if (socket) {
      util.log("closing socket");
      socket.removeListener("error", reopen);
      socket.removeListener("close", reopen);
      socket.close();
      socket = null;
    }
  }

  function closeWhenDone() {
    closing = true;
    if (socket) {
      if (!socket.bytesWaitingToFlush) close();
      else setTimeout(closeWhenDone, 1000);
    }
  }

  function open() {
    timeout = 0;
    close();
    util.log("opening socket: " + url);
    var client = new websocket.client();
    client.on("connect", function(connection) {
      socket = connection;
      socket.on("message", log);
      socket.on("error", reopen);
      socket.on("close", reopen);
      flush();
      if (closing) closeWhenDone();
    });
    client.on("connectFailed", reopen);
    client.on("error", reopen);
    client.connect(url);
  }

  function reopen() {
    if (!timeout && !closing) {
      util.log("reopening soon");
      timeout = setTimeout(open, 1000);
    }
    else {
        onmessage('timeout');
    }
  }

  function flush() {
    var event;
    while (event = queue.pop()) {
      try {
        socket.sendUTF(JSON.stringify(event));
      } catch (e) {
        util.log(e.stack);
        reopen();
        return queue.push(event);
      }
    }
  }

  function log(message) {
    util.log(message.utf8Data);
    if (reply) {
        reply(null, message.utf8Data);
    }
  }

  types.get = function(callback) {
    reply = callback;
    queue.push({});
    if (socket) flush();
    return types;
  };

  types.close = function() {
    closeWhenDone();
    return types;
  };

  open();

  return types;
};
