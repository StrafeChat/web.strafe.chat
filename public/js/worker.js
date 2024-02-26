var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g;
    return (
      (g = { next: verb(0), throw: verb(1), return: verb(2) }),
      typeof Symbol === "function" &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError("Generator is already executing.");
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y["return"]
                  : op[0]
                  ? y["throw"] || ((t = y["return"]) && t.call(y), 0)
                  : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
var OpCodes;
(function (OpCodes) {
  /**
   * Op code used for receiving events from Strafe.
   */
  OpCodes[(OpCodes["DISPATCH"] = 0)] = "DISPATCH";
  /**
   * Op code used for sending heartbeats to Strafe.
   */
  OpCodes[(OpCodes["HEARTBEAT"] = 1)] = "HEARTBEAT";
  /**
   * Op code used for sending an identify payload to Strafe.
   */
  OpCodes[(OpCodes["IDENTIFY"] = 2)] = "IDENTIFY";
  /**
   * Op code used for updating and receiving updated presences.
   */
  OpCodes[(OpCodes["PRESENCE"] = 3)] = "PRESENCE";
  /**
   * Op code used for receiving the hello event from Strafe.
   */
  OpCodes[(OpCodes["HELLO"] = 10)] = "HELLO";
})(OpCodes || (OpCodes = {}));
var WebsocketWorkerClient = /** @class */ (function () {
  function WebsocketWorkerClient() {
    this.ports = [];
    this.ws = null;
    this.gateway = null;
    this.token = null;
    this.apiUrl = null;
    this.heartbeatInterval = null;
    this.initiated = false;
    this.readyData = null;
  }
  WebsocketWorkerClient.prototype.emit = function (event, values) {
    this.ports.forEach(function (port) {
      port.postMessage({ event: event, values: values });
    });
  };
  WebsocketWorkerClient.prototype.connect = function (apiUrl, token) {
    return __awaiter(this, void 0, void 0, function () {
      var res, err_1, data;
      var _this = this;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            this.token = token;
            this.apiUrl = apiUrl;
            this.initiated = true;
            if (!!this.gateway) return [3 /*break*/, 6];
            _a.label = 1;
          case 1:
            _a.trys.push([1, 3, , 4]);
            return [4 /*yield*/, fetch(apiUrl + "/gateway")];
          case 2:
            res = _a.sent();
            return [3 /*break*/, 4];
          case 3:
            err_1 = _a.sent();
            this.emit("error", {
              code: 503,
              message:
                "Looks like the Strafe API is down. Please try reconnecting later.",
            });
            throw new Error(
              "Looks like ".concat(apiUrl + "/gateway", " might be down!")
            );
          case 4:
            return [4 /*yield*/, res.json()];
          case 5:
            data = _a.sent();
            this.gateway = data.ws;
            _a.label = 6;
          case 6:
            console.log("starting");
            this.ws = new WebSocket(this.gateway);
            this.ws.addEventListener("open", function () {
              console.log("connected");
              _this.identify();
            });
            this.ws.addEventListener("message", function (message) {
              console.log("message", message);
              var _a = JSON.parse(message.data.toString()),
                op = _a.op,
                data = _a.data;
              if (op === OpCodes.HELLO) {
                var heartbeat_interval = data.heartbeat_interval;
                _this.startHeartbeat(heartbeat_interval);
                return;
              } else if (op === OpCodes.DISPATCH) {
                _this.readyData = message.data.toString(); // TODO: improve as this is old data
              }
              _this.emit("message", message.data.toString());
            });
            this.ws.addEventListener("close", function (event) {
              console.log(event);
              _this.emit("error", {
                code: 1006,
                message:
                  "The websocket connection has been closed. Attempting to reconnect.",
              });
              if (event.code > 1000 && event.code != 4004) {
                setTimeout(function () {
                  _this.reconnect();
                }, 5000);
              }
            });
            return [2 /*return*/];
        }
      });
    });
  };
  WebsocketWorkerClient.prototype.send = function (message) {
    var _a;
    console.log("send", message);
    (_a = this.ws) === null || _a === void 0
      ? void 0
      : _a.send(JSON.stringify(message));
  };
  WebsocketWorkerClient.prototype.reconnect = function () {
    var _this = this;
    this.stopHeartbeat();
    this.ws = null;
    setTimeout(function () {
      return _this.connect(_this.apiUrl, _this.token);
    }, 5000);
  };
  WebsocketWorkerClient.prototype.stopHeartbeat = function () {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  };
  WebsocketWorkerClient.prototype.startHeartbeat = function (interval) {
    var _this = this;
    this.heartbeatInterval = setInterval(function () {
      _this.sendHeartbeat();
    }, interval);
  };
  WebsocketWorkerClient.prototype.sendHeartbeat = function () {
    var _a;
    console.log("heartbeat");
    (_a = this.ws) === null || _a === void 0
      ? void 0
      : _a.send(JSON.stringify({ op: OpCodes.HEARTBEAT }));
  };
  WebsocketWorkerClient.prototype.identify = function () {
    var _a;
    var paylod = {
      op: OpCodes.IDENTIFY,
      data: {
        token: this.token,
      },
    };
    console.log("identify", paylod);
    (_a = this.ws) === null || _a === void 0
      ? void 0
      : _a.send(JSON.stringify(paylod));
  };
  WebsocketWorkerClient.prototype.emitReadyEvent = function () {
    this.emit("message", this.readyData);
  };
  return WebsocketWorkerClient;
})();
var client = null;
onconnect = function (e) {
  var port = e.ports[0];
  if (!client) client = new WebsocketWorkerClient();
  client.ports.push(port);
  port.addEventListener("message", function (e) {
    var data = e.data;
    switch (data.type) {
      case "connect":
        if (client.initiated) return client.emitReadyEvent();
        client.connect(data.url, data.token);
        break;
      case "send":
        client.send(data.message);
        break;
      default:
        throw new Error("Invalid message type");
        break;
    }
  });
  port.start();
};
// Compile using `tsc worker.ts`
