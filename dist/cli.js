// Delta for Codex — AGPL-3.0-only. See LICENSE and NOTICE.
import { createRequire } from "node:module"; const require = createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { websocketMask, websocketUnmask } = __require("http");
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (websocketMask) {
      module.exports.mask = function(source, mask, output, offset, length) {
        if (length < 24) _mask(source, mask, output, offset, length);
        else websocketMask(source, mask, output, offset, length);
      };
      module.exports.unmask = function(buffer, mask) {
        if (buffer.length < 24) _unmask(buffer, mask);
        else websocketUnmask(buffer, mask);
      };
    } else if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && (typeof params.client_max_window_bits === "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._numFragments = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          const error = this.createError(
            RangeError,
            "Too many message fragments",
            false,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._numFragments = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex: Duplex2 } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) {
          return dataLength ? [target, data] : [target];
        }
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (!dataLength) return [target];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter2 = __require("events");
    var https = __require("https");
    var http = __require("http");
    var net = __require("net");
    var tls = __require("tls");
    var { randomBytes: randomBytes2, createHash: createHash2 } = __require("crypto");
    var { Duplex: Duplex2, Readable } = __require("stream");
    var { URL: URL2 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter2 {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            if (!options || options.protocols === void 0) {
              protocols = [];
            } else if (Array.isArray(options.protocols)) {
              protocols = options.protocols;
            } else {
              protocols = [options.protocols];
            }
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              if (options.protocols === void 0) {
                protocols = [];
              } else if (Array.isArray(options.protocols)) {
                protocols = options.protocols;
              } else {
                protocols = [options.protocols];
              }
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        this._readyState = _WebSocket.CLOSING;
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 256 * 1024,
        maxFragments: 16 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL2) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes2(16).toString("base64");
      const request2 = isSecure ? https.request : http.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const i = opts.path.indexOf(":");
        if (i === -1) {
          opts.socketPath = opts.path;
          opts.path = "";
        } else {
          opts.socketPath = opts.path.slice(0, i);
          opts.path = opts.path.slice(i + 1);
        }
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request2(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request2(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest2 = createHash2("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest2) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream2, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream2.setHeader) {
        stream2[kAborted] = true;
        stream2.abort();
        if (stream2.socket && !stream2.socket.destroyed) {
          stream2.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream2.destroy(err);
        stream2.once("error", websocket.emit.bind(websocket, "error"));
        stream2.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream2) {
      stream2.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex: Duplex2 } = __require("stream");
    function emitClose(stream2) {
      stream2.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex2({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open4() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open4() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter2 = __require("events");
    var http = __require("http");
    var { Duplex: Duplex2 } = __require("stream");
    var { createHash: createHash2 } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter2 {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http.createServer((req, res) => {
            const body = http.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest2 = createHash2("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest2}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// src/main.ts
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// src/core/process.ts
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
var MAX_FRAME = 32 * 1024 * 1024;
var run = (argv, options = {}) => new Promise((resolve2, reject) => {
  const child = spawn(argv[0], argv.slice(1), {
    cwd: options.cwd,
    windowsHide: true,
    stdio: "pipe",
    shell: false,
    env: { ...process.env, DELTA_INTEGRATION: "codex" }
  });
  let stdout = "", stderr = "", failure;
  let killTimer;
  const fail = (error) => {
    if (failure) return;
    failure = error;
    child.kill("SIGTERM");
    killTimer = setTimeout(() => child.kill("SIGKILL"), 2500);
  };
  const timer = setTimeout(() => {
    fail(new Error(`Command timed out: ${argv.slice(0, 3).join(" ")}`));
  }, options.timeout ?? 12e4);
  const capture = (which, chunk) => {
    if (which === "stdout") stdout += chunk.toString();
    else {
      stderr += chunk;
      options.onStderr?.(chunk);
    }
    if (stdout.length + stderr.length > MAX_FRAME) {
      fail(new Error("Command output exceeds the capture limit; no acknowledgment assumed"));
    }
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => capture("stdout", chunk));
  child.stderr.on("data", (chunk) => capture("stderr", chunk));
  child.on("error", (error) => {
    clearTimeout(timer);
    clearTimeout(killTimer);
    reject(error);
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    clearTimeout(killTimer);
    failure ? reject(failure) : resolve2({ code, stdout, stderr });
  });
  child.stdin.on("error", () => {
  });
  child.stdin.end(options.input);
});
function stream(argv, onLine) {
  const child = spawn(argv[0], argv.slice(1), {
    windowsHide: true,
    stdio: "pipe",
    shell: false,
    env: { ...process.env, DELTA_INTEGRATION: "codex" }
  });
  let resolveReady, rejectReady;
  let first = true, stopped = false, stderr = "";
  const ready = new Promise((resolve2, reject) => {
    resolveReady = resolve2;
    rejectReady = reject;
  });
  void ready.catch(() => {
  });
  let length = 0;
  child.stdout.on("data", (chunk) => {
    const last = chunk.lastIndexOf(10);
    length = last < 0 ? length + chunk.length : chunk.length - last - 1;
    if (length > MAX_FRAME) {
      rejectReady(new Error("Delta stream frame too large"));
      child.kill();
    }
  });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      if (line.length > MAX_FRAME) throw new Error("Delta stream frame too large");
      if (first) {
        first = false;
        resolveReady(JSON.parse(line));
      }
      onLine?.(line);
    } catch (error) {
      rejectReady(error);
      child.kill();
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4096);
  });
  const done = new Promise((resolve2, reject) => {
    child.on("error", (error) => {
      rejectReady(error);
      reject(error);
    });
    child.on("close", (code) => {
      lines.close();
      rejectReady(new Error(stderr || `Delta stream exited ${code}`));
      if (stopped || code === 0) resolve2();
      else reject(new Error(stderr || `Delta stream exited ${code}`));
    });
  });
  void done.catch(() => {
  });
  return {
    ready,
    done,
    stop: async () => {
      stopped = true;
      await terminate(child, done);
    }
  };
}
async function terminate(child, done) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 2500);
  try {
    await done.catch(() => {
    });
  } finally {
    clearTimeout(timer);
  }
}
async function deadline(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// src/core/json.ts
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function isOneOf(value, allowed) {
  return allowed.includes(value);
}
function jsonText(value) {
  return typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
}

// src/core/paths.ts
function pathKey(path, ...counterparts) {
  const windows = (value) => /^[a-z]:[\\/]/i.test(value) || value.startsWith("\\\\");
  return windows(path) || counterparts.some(windows) ? path.replace(/\\/g, "/") : path;
}
function samePath(left, right) {
  return pathKey(left, right) === pathKey(right, left);
}

// src/cli/thread-commands.ts
var SOURCE = "codex";
var PRODUCER_NAME = "Codex";
var DeltaCommandError = class extends Error {
  constructor(code, message, hints = {}, reason) {
    super(message);
    this.code = code;
    this.hints = hints;
    this.reason = reason;
    this.name = "DeltaCommandError";
  }
  code;
  hints;
  reason;
};
function commandErrorFromEnvelope(error, name) {
  if (!isJsonObject(error) || typeof error.code !== "string" || typeof error.message !== "string") return;
  const reason = isNonEmptyString(error.reason) ? error.reason : void 0;
  const label = reason && reason !== error.code ? `${error.code} (${reason})` : error.code;
  return new DeltaCommandError(
    error.code,
    `${name ? `${name}: ` : ""}${label}: ${error.message}`,
    {
      ...typeof error.retryable === "boolean" ? { retryable: error.retryable } : {},
      ...isFiniteNumber(error.retry_after_ms) && error.retry_after_ms >= 0 ? { retryAfterMs: error.retry_after_ms } : {}
    },
    reason
  );
}
function commandErrorFromOutput(text2, name) {
  let value;
  try {
    value = JSON.parse(text2);
  } catch {
    return void 0;
  }
  return isJsonObject(value) ? commandErrorFromEnvelope(value.error, name) : void 0;
}
function envelopeError(value) {
  return isJsonObject(value) ? commandErrorFromEnvelope(value.error) : void 0;
}
var LOCAL_FAILURE_CLASSES = {
  process_failed: "transient",
  timeout: "transient",
  command_failed: "permanent",
  invalid_acknowledgment: "permanent"
};
function classifyCommandFailure(error) {
  if (!(error instanceof DeltaCommandError)) return "permanent";
  if (error.hints.retryable !== void 0) return error.hints.retryable ? "transient" : "permanent";
  return LOCAL_FAILURE_CLASSES[error.code] ?? "permanent";
}
function appendFailure(stdout, stderr, exitCode) {
  for (const line of stdout.trim().split("\n").reverse()) {
    const failure = commandErrorFromOutput(line);
    if (failure) return failure;
  }
  return new DeltaCommandError("process_failed", stderr.trim() || `append exited ${exitCode ?? "abnormally"}`);
}
function parseWatchEvent(line) {
  const event = JSON.parse(line);
  if (!isJsonObject(event))
    throw new Error("Unexpected thread watch event; use matching CLI and extension builds");
  const failure = commandErrorFromEnvelope(event.error);
  if (failure) return { type: "error", error: failure };
  switch (event.type) {
    case "ready":
      if (isNonEmptyString(event.thread_id) && validProducer(event.producer))
        return { type: "ready", thread_id: event.thread_id, producer: event.producer };
      break;
    case "item":
      if (validItem(event.item)) return { type: "item", item: event.item };
      break;
    case "item.append":
      if (isNonEmptyString(event.id) && typeof event.text === "string")
        return { type: "item.append", id: event.id, text: event.text };
      break;
    case "remove":
      if (isNonEmptyString(event.id)) return { type: "remove", id: event.id };
      break;
    case "live":
      return { type: "live" };
    case "turn":
      if (isOneOf(event.state, ["idle", "running"]) && (event.turn_id === null || isNonEmptyString(event.turn_id)) && (event.user === null || validUser(event.user)))
        return { type: "turn", state: event.state, turn_id: event.turn_id, user: event.user };
      break;
    case "producer.turn":
      if (validTurn(event)) return { type: "producer.turn", sequence: event.sequence, status: event.status };
      break;
    case "presence":
      if (Array.isArray(event.users) && event.users.every(validUser))
        return { type: "presence", users: event.users };
      break;
    case "children":
      if (Array.isArray(event.children) && event.children.every(validChild))
        return { type: "children", children: event.children.map(watchChild) };
      break;
    case "child":
      if (validChild(event.child)) return { type: "child", child: watchChild(event.child) };
      break;
    case "child.remove":
      if (isNonEmptyString(event.thread_id)) return { type: "child.remove", thread_id: event.thread_id };
      break;
    case "worktrees":
      if (Array.isArray(event.worktrees) && event.worktrees.every(validWorktreeName))
        return {
          type: "worktrees",
          worktrees: event.worktrees.map((tree) => ({ reference: tree.reference, name: tree.name }))
        };
      break;
    case "comment":
      if (validComment(event.comment)) return { type: "comment", comment: event.comment };
      break;
    case "comment.remove":
      if (isNonEmptyString(event.id)) return { type: "comment.remove", id: event.id };
      break;
    default:
      if (typeof event.type === "string") return;
  }
  throw new Error("Unexpected thread watch event; use matching CLI and extension builds");
}
function validWorktreeName(tree) {
  return isJsonObject(tree) && isNonEmptyString(tree.reference) && typeof tree.name === "string";
}
function validChild(child) {
  return isJsonObject(child) && isNonEmptyString(child.thread_id) && isNonEmptyString(child.kind) && typeof child.name === "string" && isNonEmptyString(child.status) && isNonEmptyString(child.reference);
}
function watchChild(child) {
  return {
    thread_id: child.thread_id,
    reference: child.reference,
    kind: child.kind,
    name: child.name,
    status: child.status
  };
}
function validComment(comment) {
  return isJsonObject(comment) && isNonEmptyString(comment.id) && isNonEmptyString(comment.chain) && isNonEmptyString(comment.delivered_with) && (comment.after_id === null || isNonEmptyString(comment.after_id)) && (comment.routed_to === null || isNonEmptyString(comment.routed_to)) && validUser(comment.author) && Array.isArray(comment.co_authors) && comment.co_authors.every(validUser) && typeof comment.agent === "boolean" && (comment.created_at === null || isFiniteNumber(comment.created_at)) && typeof comment.text === "string" && (comment.target === null || validCommentTarget(comment.target));
}
function validCommentTarget(target) {
  if (!isJsonObject(target)) return false;
  if (target.kind === "transcript")
    return (target.item_id === null || isNonEmptyString(target.item_id)) && typeof target.quote === "string";
  if (target.kind === "file")
    return typeof target.path === "string" && typeof target.view === "string" && (target.worktree === null || isNonEmptyString(target.worktree)) && (target.selected === null || typeof target.selected === "string") && Array.isArray(target.regions) && target.regions.every(
      (region) => isJsonObject(region) && isSafeInteger(region.first_line) && isSafeInteger(region.last_line) && typeof region.status === "string" && typeof region.text === "string"
    );
  return typeof target.kind === "string";
}
function validItem(item) {
  return isJsonObject(item) && isNonEmptyString(item.id) && isNonEmptyString(item.kind) && (item.after_id === null || isNonEmptyString(item.after_id)) && (item.turn_id === null || isNonEmptyString(item.turn_id)) && (item.author === null || validUser(item.author)) && (item.created_at === null || isFiniteNumber(item.created_at)) && typeof item.open === "boolean" && isJsonObject(item.content);
}
function validUser(user) {
  return isJsonObject(user) && (user.user_id === null || isNonEmptyString(user.user_id)) && (user.name === null || typeof user.name === "string") && (user.actor_id === void 0 || isNonEmptyString(user.actor_id));
}
function parseThreadStatus(line) {
  const status2 = JSON.parse(line);
  const failure = envelopeError(status2);
  if (failure) throw failure;
  if (isJsonObject(status2) && status2.operation === "status" && validBinding(status2)) return status2;
  throw new Error("Unexpected thread status; use matching CLI and extension builds");
}
function validBinding(frame) {
  return isNonEmptyString(frame.thread_id) && (frame.url === null || isNonEmptyString(frame.url)) && (frame.title === null || typeof frame.title === "string") && isJsonObject(frame.access) && isOneOf(frame.access.state, ["local_only", "granted"]) && (frame.access.is_owner === null || typeof frame.access.is_owner === "boolean") && (frame.visibility === null || isOneOf(frame.visibility, ["private", "organization", "unlisted"])) && (frame.upload === null || validUpload(frame.upload)) && validWorktrees(frame.worktrees) && validProducer(frame.producer);
}
function validUpload(value) {
  return isJsonObject(value) && isOneOf(value.state, ["queued", "uploading", "uploaded", "failed"]) && (value.organization_id === null || isNonEmptyString(value.organization_id)) && (value.error === null || validErrorObject(value.error));
}
function validErrorObject(error) {
  return isJsonObject(error) && typeof error.code === "string" && (error.reason === void 0 || typeof error.reason === "string") && typeof error.message === "string";
}
function validProducer(value) {
  return value === null || isJsonObject(value) && isNonEmptyString(value.source) && isNonEmptyString(value.external_id) && isSafeInteger(value.next_sequence) && value.next_sequence >= 1 && (value.actor_id === void 0 || value.actor_id === null || isNonEmptyString(value.actor_id)) && (value.turn === null || validTurn(value.turn));
}
function validWorktrees(value) {
  if (!isJsonObject(value)) return false;
  if (value.status === "unavailable") return validErrorObject(value.error);
  return value.status === "available" && Array.isArray(value.items) && value.items.every(
    (worktree) => isJsonObject(worktree) && isNonEmptyString(worktree.reference) && Array.isArray(worktree.checkouts) && worktree.checkouts.every(
      (checkout) => isJsonObject(checkout) && isNonEmptyString(checkout.directory) && isOneOf(checkout.state, ["attached", "inactive", "detached", "missing"]) && (checkout.active === void 0 || typeof checkout.active === "boolean")
    )
  );
}
function inspectionUnavailableMessage(error) {
  const label = error.reason && error.reason !== error.code ? `${error.code} (${error.reason})` : error.code;
  return `Delta checkout inspection unavailable (${label}): ${error.message}. Resolve the inspection failure and retry; the existing binding and queued messages were preserved.`;
}
var EXTENSION_CONTRACT_MIN = 8;
var EXTENSION_CONTRACT_MAX = 10;
function parseThreadContract(line) {
  let result;
  try {
    result = JSON.parse(line);
  } catch {
    throw new Error("Unexpected thread contract; use matching CLI and extension builds");
  }
  const failure = envelopeError(result);
  if (failure) throw failure;
  if (!isJsonObject(result) || result.operation !== "contract" || !isSafeInteger(result.min) || !isSafeInteger(result.max) || result.min < 0 || result.max < result.min)
    throw new Error("Unexpected thread contract; use matching CLI and extension builds");
  return { operation: "contract", min: result.min, max: result.max };
}
function contractRefusal(range) {
  if (!range || range.max < EXTENSION_CONTRACT_MIN)
    return "This Delta is too old for this extension. Update Delta to continue";
  if (range.min > EXTENSION_CONTRACT_MAX)
    return "This Delta is newer than this extension. Update the Delta extension for Codex to continue";
}
function contractVersion(range) {
  return Math.min(range.max, EXTENSION_CONTRACT_MAX);
}
var JoinNotReadyError = class extends Error {
};
function parseThreadMount(line, owner) {
  const result = JSON.parse(line);
  const failure = envelopeError(result);
  if (failure) throw failure;
  if (!isJsonObject(result) || result.operation !== "mounted" || !isNonEmptyString(result.thread_id) || result.owner !== owner || !isNonEmptyString(result.directory) || !Array.isArray(result.worktrees) || !result.worktrees.every(validMount))
    throw new Error("Unexpected thread mount result; use matching CLI and extension builds");
  return {
    thread_id: result.thread_id,
    owner,
    directory: result.directory,
    worktrees: result.worktrees.map((tree) => ({
      reference: tree.reference,
      name: tree.name,
      directory: tree.directory,
      state: tree.state
    }))
  };
}
function validateJoinedMounts(state, mounts) {
  if (state.access.state !== "granted")
    throw new Error("Access to the joined thread is not granted; check your Delta sign-in and thread access");
  if (state.worktrees.status === "unavailable")
    throw new DeltaCommandError(
      state.worktrees.error.code,
      inspectionUnavailableMessage(state.worktrees.error),
      {},
      state.worktrees.error.reason
    );
  const items = state.worktrees.items;
  for (const mount of mounts) {
    const ready = items.some(
      (tree) => tree.reference === mount.reference && tree.checkouts.some(
        (checkout) => samePath(checkout.directory, mount.directory) && checkout.active === true && ["attached", "detached"].includes(checkout.state)
      )
    );
    if (!ready)
      throw new JoinNotReadyError(
        `The worktree "${mount.name}" is not mounted at ${mount.directory} yet. Wait for Delta to finish mounting it, or run /delta-join with this thread's link to mount it again`
      );
  }
}
function validMount(tree) {
  return isJsonObject(tree) && isNonEmptyString(tree.reference) && isNonEmptyString(tree.name) && isNonEmptyString(tree.directory) && isNonEmptyString(tree.state);
}
function parseAppendReceipt(line, thread, sequence) {
  const ack = JSON.parse(line);
  if (!isJsonObject(ack) || !validReceipt(ack, thread, sequence))
    throw new Error("Invalid thread acknowledgment; no delivery assumed");
  return ack;
}
function validReceipt(ack, thread, sequence) {
  return ack.thread_id === thread && ack.sequence === sequence && isSafeInteger(ack.next_sequence) && ack.next_sequence > sequence && typeof ack.duplicate === "boolean" && isNonEmptyString(ack.version) && ack.operation === "appended" && isOneOf(ack.disposition, ["recorded", "fenced", "duplicate"]) && (ack.turn_sequence === null || isSafeInteger(ack.turn_sequence) && ack.turn_sequence > 0 && ack.turn_sequence <= sequence);
}
function validTurn(value) {
  return isJsonObject(value) && isSafeInteger(value.sequence) && value.sequence > 0 && isOneOf(value.status, ["running", "finished", "superseded"]);
}
function validateThreadFrontier(ready, binding) {
  if (binding.thread && binding.thread !== ready.thread_id)
    throw new Error("Delta returned a different conversation; the existing binding was preserved");
  if (!ready.producer || ready.producer.source !== SOURCE || ready.producer.external_id !== binding.session)
    throw new Error(
      "Delta returned a different or missing Codex producer; the existing binding was preserved"
    );
  const acknowledgedThrough = binding.pending.reduce(
    (frontier, entry) => Math.min(frontier, entry.sequence),
    binding.next
  );
  if (ready.producer.next_sequence < acknowledgedThrough)
    throw new Error(
      "Delta has lost acknowledged client history. Restore the common account store or start a new Codex session; do not reset the sequence."
    );
  if (ready.producer.next_sequence > binding.next)
    throw new Error(
      "Delta is ahead of this Codex outbox. Restore the matching producer state; do not reuse sequence numbers."
    );
}

// src/cli/delta.ts
var Delta = class {
  constructor(executable = process.env.DELTA_CODEX_DELTA_BIN || "delta", runner = run) {
    this.executable = executable;
    this.runner = runner;
  }
  executable;
  runner;
  async command(args, input) {
    const value = await this.query(args, input);
    if (!isJsonObject(value)) throw new Error("Delta returned an invalid response");
    return value;
  }
  async query(args, input) {
    const result = await this.runner([this.executable, "--json", ...args], {
      input,
      timeout: args[0] === "update" ? 66e4 : 12e4,
      ...args[0] === "update" || args[0] === "auth" && args[1] === "login" ? {
        onStderr: (text2) => {
          process.stderr.write(text2);
        }
      } : {}
    });
    let value;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      throw new Error(
        `Delta ${args.slice(0, 2).join(" ")} returned invalid JSON: ${result.stderr.slice(-1e3)}`
      );
    }
    const error = isJsonObject(value) ? commandErrorFromEnvelope(value.error) : void 0;
    if (error) throw error;
    if (result.code !== 0)
      throw new DeltaCommandError("process_failed", result.stderr || `Delta exited ${result.code}`, {
        retryable: true
      });
    return value;
  }
  async contract() {
    const range = parseThreadContract(JSON.stringify(await this.command(["thread", "contract"])));
    const refusal = contractRefusal(range);
    if (refusal) throw new Error(refusal);
    return contractVersion(range);
  }
  async status(reference, session) {
    return parseThreadStatus(
      JSON.stringify(
        await this.command(["thread", "status", reference, "--source", SOURCE, "--external-id", session])
      )
    );
  }
  async append(reference, session, local, input) {
    try {
      return await this.runner(
        [
          this.executable,
          "--json",
          "thread",
          "append",
          reference,
          "--source",
          SOURCE,
          "--external-id",
          session,
          "--producer-name",
          PRODUCER_NAME,
          ...local ? ["--acknowledge", "local"] : []
        ],
        { input }
      );
    } catch (error) {
      throw new DeltaCommandError("process_failed", String(error), { retryable: true });
    }
  }
  watch(reference, session, onLine) {
    return stream(
      [
        this.executable,
        "--json",
        "thread",
        "watch",
        reference,
        "--source",
        SOURCE,
        "--external-id",
        session,
        "--participate",
        PRODUCER_NAME
      ],
      onLine
    );
  }
  async mount(args) {
    const process2 = stream([this.executable, "--json", ...args]);
    try {
      const value = await deadline(process2.ready, 12e4, "Delta mount");
      if (!isJsonObject(value)) throw new Error("Invalid mount response");
      const error = commandErrorFromEnvelope(value.error);
      if (error) throw error;
      if (value.operation !== "mounted") throw new Error("Delta did not confirm the mount");
      return { value, process: process2 };
    } catch (error) {
      await process2.stop();
      throw error;
    }
  }
};

// src/codex/rpc.ts
import { spawn as spawn2 } from "node:child_process";
import { createInterface as createInterface2 } from "node:readline";
import { EventEmitter } from "node:events";
import { Duplex } from "node:stream";

// node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);
var wrapper_default = import_websocket.default;

// src/codex/rpc.ts
var RpcError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  code;
};
var Codex = class extends EventEmitter {
  constructor(argv = [process.env.DELTA_CODEX_CODEX_BIN || "codex", "app-server", "proxy"], environment = {}) {
    super();
    this.argv = argv;
    this.environment = environment;
  }
  argv;
  environment;
  child;
  socket;
  opening;
  next = 0;
  pending = /* @__PURE__ */ new Map();
  done = Promise.resolve();
  stderr = "";
  requests = /* @__PURE__ */ new Map();
  async connect() {
    if (this.opening) return this.opening;
    this.opening = this.open();
    try {
      await this.opening;
    } catch (error) {
      this.opening = void 0;
      throw error;
    }
  }
  async open() {
    const child = this.child = spawn2(this.argv[0], this.argv.slice(1), {
      stdio: "pipe",
      windowsHide: true,
      shell: false,
      env: { ...process.env, ...this.environment }
    });
    const websocket = this.argv.includes("proxy");
    const lines = websocket ? void 0 : createInterface2({ input: child.stdout });
    child.stdin.on("error", () => {
    });
    child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk.toString()).slice(-2e3);
    });
    let length = 0;
    if (!websocket)
      child.stdout.on("data", (chunk) => {
        const last = chunk.lastIndexOf(10);
        length = last < 0 ? length + chunk.length : chunk.length - last - 1;
        if (length > MAX_FRAME) child.kill();
      });
    const receive = (line) => {
      try {
        if (line.length > MAX_FRAME) throw new Error("Oversize Codex frame");
        const message = JSON.parse(line);
        if ("id" in message && !message.method) {
          const request2 = this.pending.get(message.id);
          if (request2) {
            this.pending.delete(message.id);
            clearTimeout(request2.timer);
            message.error ? request2.reject(new RpcError(message.error.code, message.error.message)) : request2.resolve(message.result);
          }
        } else if ("id" in message) {
          this.requests.set(String(message.id), message);
          if (this.listenerCount("request")) this.emit("request", message);
          else this.respond(String(message.id), void 0, "No interactive approval handler is attached");
        } else this.emit("notification", message);
      } catch (error) {
        this.emit("diagnostic", String(error));
        child.kill();
      }
    };
    lines?.on("line", receive);
    this.done = new Promise((resolve2) => {
      const closed = () => {
        for (const request2 of this.pending.values()) {
          clearTimeout(request2.timer);
          request2.reject(new Error(`Codex daemon disconnected. ${this.stderr}`));
        }
        this.pending.clear();
        this.requests.clear();
        this.opening = void 0;
        this.child = void 0;
        this.socket?.terminate();
        this.socket = void 0;
        lines?.close();
        resolve2();
      };
      child.once("error", closed);
      child.once("close", closed);
    });
    if (websocket) {
      const socket = this.socket = new wrapper_default("ws://localhost/", {
        createConnection: () => Duplex.from({ readable: child.stdout, writable: child.stdin }),
        handshakeTimeout: 1e4,
        maxPayload: MAX_FRAME,
        perMessageDeflate: false
      });
      socket.on("message", (data, binary) => {
        if (binary) {
          this.emit("diagnostic", "Unexpected binary Codex frame");
          child.kill();
        } else receive(data.toString());
      });
      socket.on("error", (error) => {
        this.stderr = String(error);
        child.kill();
      });
      socket.on("close", () => child.kill());
      await new Promise((resolve2, reject) => {
        socket.once("open", resolve2);
        socket.once("error", reject);
        socket.once("close", () => reject(new Error(`Codex daemon disconnected. ${this.stderr}`)));
      });
    }
    await this.request(
      "initialize",
      {
        clientInfo: { name: "delta_codex", title: "Delta for Codex", version: "0.1.0" },
        capabilities: { experimentalApi: true }
      },
      1e4
    );
    this.send({ method: "initialized", params: {} });
  }
  send(value) {
    if (!this.child?.stdin.writable)
      throw new Error("Codex daemon is not connected. Start Codex with its shared daemon enabled.");
    if (this.socket) {
      if (this.socket.readyState !== wrapper_default.OPEN) throw new Error("Codex daemon is not connected");
      this.socket.send(JSON.stringify(value));
    } else this.child.stdin.write(JSON.stringify(value) + "\n");
  }
  request(method, params, timeout) {
    return new Promise((resolve2, reject) => {
      const id = ++this.next;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex ${method} timed out`));
      }, timeout);
      this.pending.set(id, { resolve: resolve2, reject, timer });
      try {
        this.send({ id, method, params });
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }
  async call(method, params, timeout = 3e4) {
    await this.connect();
    return this.request(method, params, timeout);
  }
  respond(id, result, error) {
    const request2 = this.requests.get(id);
    if (!request2) throw new Error("This Codex approval request is no longer pending");
    this.send(
      error ? { id: request2.id, error: { code: -32601, message: error } } : { id: request2.id, result }
    );
    this.requests.delete(id);
  }
  async close() {
    if (this.child) await terminate(this.child, this.done);
  }
};
async function history(rpc, threadId, throughTurn) {
  const turns = [], cursors = /* @__PURE__ */ new Set();
  let cursor;
  try {
    do {
      const page = await rpc.call("thread/turns/list", {
        threadId,
        cursor,
        limit: throughTurn ? 20 : 100,
        sortDirection: throughTurn ? "desc" : "asc",
        itemsView: "full"
      });
      if (!Array.isArray(page.data)) throw new Error("Invalid Codex turn history");
      for (const turn of page.data) {
        if (turn.itemsView !== "full") {
          turn.items = [];
          let itemCursor;
          const seen = /* @__PURE__ */ new Set();
          do {
            const items = await rpc.call("thread/items/list", {
              threadId,
              turnId: turn.id,
              cursor: itemCursor,
              sortDirection: "asc",
              limit: 100
            });
            if (!Array.isArray(items.data)) throw new Error("Invalid Codex item history");
            turn.items.push(...items.data.map((entry) => entry.item));
            itemCursor = items.nextCursor ?? void 0;
            if (itemCursor && seen.has(itemCursor)) throw new Error("Codex repeated an item cursor");
            if (itemCursor) seen.add(itemCursor);
          } while (itemCursor);
        }
        turns.push(turn);
        if (throughTurn && turn.id === throughTurn) return turns.reverse();
      }
      cursor = page.nextCursor ?? void 0;
      if (cursor && cursors.has(cursor)) throw new Error("Codex repeated a turn cursor");
      if (cursor) cursors.add(cursor);
    } while (cursor);
    return throughTurn ? turns.reverse() : turns;
  } catch (error) {
    if (!(error instanceof RpcError) || ![-32601, -32600].includes(error.code)) throw error;
    const value = await rpc.call("thread/read", { threadId, includeTurns: true });
    if (!Array.isArray(value.thread?.turns)) throw new Error("Codex cannot provide this session history");
    return value.thread.turns;
  }
}

// src/core/storage.ts
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
var digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
var dataDirectory = () => process.env.DELTA_CODEX_HOME || join(process.env.CODEX_HOME || join(homedir(), ".codex"), "delta");
async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 448 });
  const temp = `${path}.${randomUUID()}.tmp`;
  const file = await open(temp, "wx", 384);
  try {
    await file.writeFile(JSON.stringify(value) + "\n");
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(temp, path);
    if (process.platform !== "win32") {
      const directory = await open(dirname(path), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    }
  } finally {
    await unlink(temp).catch(() => {
    });
  }
}
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
var Serial = class {
  tail = Promise.resolve();
  run(work) {
    const next = this.tail.then(work);
    this.tail = next.catch(() => {
    });
    return next;
  }
};

// src/ipc.ts
import { createServer, createConnection } from "node:net";
import { mkdir as mkdir3, chmod, unlink as unlink2, open as open3, stat as stat2, lstat } from "node:fs/promises";
import { join as join4 } from "node:path";
import { tmpdir } from "node:os";
import { spawn as spawn3 } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";

// src/bridge.ts
import { randomUUID as randomUUID2 } from "node:crypto";

// src/recording/store.ts
import { join as join2 } from "node:path";
function freshBinding(input) {
  return {
    ...input,
    version: 1,
    next: 1,
    pending: [],
    seen: {},
    turns: {},
    ledger: { thread: input.thread, items: {} },
    failures: 0,
    created: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function stage(state, update, turnSequence) {
  if (!Number.isSafeInteger(state.next) || state.next < 1 || state.next >= Number.MAX_SAFE_INTEGER)
    throw new Error("Invalid sequence frontier");
  const record = {
    schemaVersion: 1,
    sequence: state.next++,
    ...turnSequence ? { turnSequence } : {},
    update
  };
  state.pending.push(record);
  return record.sequence;
}
var Recording = class _Recording {
  constructor(path, state) {
    this.path = path;
    this.state = state;
  }
  path;
  state;
  serial = new Serial();
  static path(directory, session) {
    return join2(directory, "sessions", digest(session) + ".json");
  }
  static async load(directory, session) {
    const path = this.path(directory, session), value = await readJson(path);
    if (!value) return void 0;
    validateBinding(value, session);
    return new _Recording(path, value);
  }
  async change(fn) {
    return this.serial.run(async () => {
      const draft = structuredClone(this.state), result = await fn(draft);
      await atomicJson(this.path, draft);
      this.state = draft;
      return result;
    });
  }
  async reconcile(delta) {
    const state = await delta.status(this.state.reference, this.state.session);
    validateThreadFrontier(state, this.state);
    return state;
  }
  async begin(turn) {
    await this.change((state) => {
      if (state.turns[turn]?.superseded)
        throw new Error("This turn was taken over in Delta. Send a new prompt to take another turn.");
      if (!state.turns[turn])
        state.turns[turn] = {
          sequence: stage(state, { sessionUpdate: "state_update", state: "running" }, state.next)
        };
      state.active = turn;
    });
  }
  async finish(turn, reason = "end_turn") {
    await this.change((state) => {
      const saved = state.turns[turn];
      if (saved && !saved.finished) {
        stage(state, { sessionUpdate: "state_update", state: "idle", stopReason: reason }, saved.sequence);
        saved.finished = true;
      }
      if (state.active === turn) delete state.active;
    });
  }
  /** Valid receipts can precede a failed batch. Persist only that acknowledged prefix. */
  async drain(delta, onFenced) {
    const fenced = [];
    await this.serial.run(async () => {
      const state = structuredClone(this.state);
      if (!state.pending.length || state.paused || (state.retryAt ?? 0) > Date.now()) return;
      let bytes = 0;
      const batch = [];
      for (const record of state.pending) {
        const size = Buffer.byteLength(JSON.stringify(record));
        if (batch.length && (bytes + size > 1024 * 1024 || batch.length >= 128)) break;
        bytes += size;
        batch.push(record);
      }
      let failure;
      try {
        const result = await delta.append(
          state.reference,
          state.session,
          state.kind !== "join",
          batch.map((r) => JSON.stringify(r)).join("\n") + "\n"
        );
        const lines = result.stdout.trim().split("\n").filter(Boolean);
        let count = 0;
        for (const line of lines) {
          if (count >= batch.length)
            throw new DeltaCommandError("invalid_acknowledgment", "Unexpected extra append receipt");
          const record = batch[count];
          let receipt;
          try {
            receipt = parseAppendReceipt(line, state.thread, record.sequence);
          } catch {
            throw commandErrorFromOutput(line) ?? new DeltaCommandError("invalid_acknowledgment", "Malformed append receipt; no delivery assumed");
          }
          if (receipt.turn_sequence !== (record.turnSequence ?? null))
            throw new DeltaCommandError("invalid_acknowledgment", "Append receipt names a different turn");
          if (receipt.disposition === "fenced") {
            for (const [id, turn] of Object.entries(state.turns))
              if (turn.sequence === record.turnSequence && !turn.superseded) {
                turn.superseded = true;
                fenced.push(id);
              }
          }
          state.pending.shift();
          count++;
        }
        if (result.code !== 0 || count !== batch.length)
          throw appendFailure(result.stdout, result.stderr, result.code);
        state.failures = 0;
        delete state.retryAt;
      } catch (error) {
        failure = error;
      }
      if (failure) {
        const message = failure instanceof Error ? failure.message : String(failure);
        if (classifyCommandFailure(failure) === "transient") {
          state.failures++;
          const delay = failure instanceof DeltaCommandError ? failure.hints.retryAfterMs : void 0;
          state.retryAt = Date.now() + Math.max(delay ?? 0, Math.min(6e4, 500 * 2 ** Math.min(state.failures, 7)));
        } else state.paused = message;
      }
      await atomicJson(this.path, state);
      this.state = state;
    });
    for (const turn of fenced) await onFenced(turn);
  }
};
function validateBinding(value, session) {
  if (value.version !== 1 || value.session !== session || typeof value.thread !== "string" || typeof value.reference !== "string" || !Number.isSafeInteger(value.next) || value.next < 1 || !Array.isArray(value.pending) || !value.seen || !value.turns || !value.ledger)
    throw new Error(
      "Invalid saved Delta state. Preserve it for recovery; do not reset this session\u2019s sequence."
    );
  let previous = value.pending[0]?.sequence ?? value.next;
  for (const record of value.pending) {
    if (record.schemaVersion !== 1 || record.sequence !== previous++ || record.sequence >= value.next || !record.update?.sessionUpdate)
      throw new Error("Corrupt Delta outbox. Preserve it for recovery; start a new Codex session.");
  }
  if (previous !== value.next) throw new Error("Delta outbox has a sequence gap");
}

// src/recording/translate.ts
var REMOTE_PREFIX = "[Delta collaboration context";
var text = (value) => ({ type: "text", text: jsonText(value) });
var content = (value) => ({ type: "content", content: text(value) });
function translate(item, parent) {
  const id = String(item.id);
  switch (item.type) {
    case "userMessage": {
      const blocks = (item.content ?? []).map((part) => {
        if (part.type === "text") return text(part.text);
        if (part.type === "image" && typeof part.url === "string") {
          const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/.exec(part.url);
          if (match) return { type: "image", mimeType: match[1], data: match[2] };
        }
        return text(part);
      });
      if (blocks.some((b) => b.type === "text" && b.text.startsWith(REMOTE_PREFIX))) return [];
      return [
        {
          sessionUpdate: "user_message",
          messageId: id,
          content: blocks,
          ...parent ? { _meta: { delta: { sender: { external_id: parent } } } } : {}
        }
      ];
    }
    case "agentMessage":
      if (item.text?.startsWith(REMOTE_PREFIX)) return [];
      return [{ sessionUpdate: "agent_message", messageId: id, content: [text(item.text ?? "")] }];
    case "reasoning": {
      const visible = [...item.summary ?? [], ...item.content ?? []].filter(
        (s) => typeof s === "string"
      );
      return visible.length ? [{ sessionUpdate: "agent_thought", messageId: id, content: visible.map(text) }] : [];
    }
    case "plan":
      return [{ sessionUpdate: "agent_message", messageId: id, content: [text(item.text)] }];
    case "commandExecution":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: item.command,
          kind: "execute",
          status: status(item.status),
          rawInput: { command: item.command, cwd: item.cwd },
          rawOutput: { exitCode: item.exitCode, output: item.aggregatedOutput },
          content: item.aggregatedOutput ? [content(item.aggregatedOutput)] : []
        }
      ];
    case "fileChange":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: "Apply patch",
          kind: "edit",
          status: status(item.status),
          rawInput: item.changes,
          locations: (item.changes ?? []).map((c) => ({ path: c.path })),
          content: (item.changes ?? []).map((c) => ({
            type: "diff",
            changes: [
              {
                path: c.path,
                operation: c.kind?.type === "add" ? "add" : c.kind?.type === "delete" ? "delete" : "modify"
              }
            ],
            patch: { format: "git_patch", text: c.diff }
          }))
        }
      ];
    case "mcpToolCall":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: `${item.server}/${item.tool}`,
          kind: "other",
          status: status(item.status),
          rawInput: item.arguments,
          rawOutput: item.result ?? item.error,
          content: item.result || item.error ? [content(item.result ?? item.error)] : []
        }
      ];
    case "dynamicToolCall":
    case "collabAgentToolCall":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: item.tool,
          kind: "other",
          status: status(item.status),
          rawInput: item.arguments ?? { prompt: item.prompt, receivers: item.receiverThreadIds },
          rawOutput: item.contentItems ?? item.agentsStates
        }
      ];
    case "functionCallOutput":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: item.name,
          kind: "other",
          status: "completed",
          rawOutput: item.output,
          content: [content(item.output)]
        }
      ];
    case "webSearch":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: "Web search",
          kind: "search",
          status: "completed",
          rawInput: item.action ?? item.query
        }
      ];
    case "imageView":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: "View image",
          kind: "read",
          status: "completed",
          rawInput: { path: item.path }
        }
      ];
    case "imageGeneration":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: "Generate image",
          kind: "other",
          status: status(item.status),
          rawOutput: item.result ?? item.revisedPrompt
        }
      ];
    case "enteredReviewMode":
    case "exitedReviewMode":
      return [{ sessionUpdate: "agent_message", messageId: id, content: [text(item.review)] }];
    // Compaction and hook framing aren't user conversation. Future item types are deliberately skipped.
    default:
      return [];
  }
}
function status(value) {
  return ["failed", "declined", "cancelled"].includes(value) ? "failed" : value === "inProgress" ? "in_progress" : "completed";
}
function recordTurns(state, turns) {
  const children = /* @__PURE__ */ new Set();
  for (const turn of turns) {
    if (turn.status === "inProgress" && !state.turns[turn.id]) {
      state.turns[turn.id] = {
        sequence: stage(state, { sessionUpdate: "state_update", state: "running" }, state.next)
      };
      state.active = turn.id;
    }
    const sequence = state.turns[turn.id]?.sequence;
    for (const item of turn.items ?? []) {
      if (item.type === "collabAgentToolCall" && ["spawnAgent", "spawn_agent"].includes(item.tool))
        for (const child of item.receiverThreadIds ?? []) children.add(child);
      if (item.type === "subAgentActivity" && item.agentThreadId) children.add(item.agentThreadId);
      const updates = translate(item, state.parent);
      const key = `${turn.id}:${item.id}`, fingerprint2 = digest(updates);
      if (state.seen[key] === fingerprint2) continue;
      for (const update of updates) stage(state, update, sequence);
      state.seen[key] = fingerprint2;
    }
    if (turn.status !== "inProgress" && state.turns[turn.id] && !state.turns[turn.id].finished) {
      stage(
        state,
        {
          sessionUpdate: "state_update",
          state: "idle",
          stopReason: turn.status === "completed" ? "end_turn" : "cancelled"
        },
        sequence
      );
      state.turns[turn.id].finished = true;
      if (state.active === turn.id) delete state.active;
    }
  }
  return [...children];
}

// src/recording/images.ts
import { open as open2, stat } from "node:fs/promises";
var MAX_IMAGE = 20 * 1024 * 1024;
var Images = class {
  cache = /* @__PURE__ */ new Map();
  bytes = 0;
  async materialize(turns) {
    const result = structuredClone(turns);
    for (const turn of result)
      for (const item of turn.items ?? []) {
        if (item.type !== "userMessage" || !Array.isArray(item.content)) continue;
        item.content = await Promise.all(
          item.content.map(async (part) => {
            if (part.type !== "localImage" || typeof part.path !== "string") return part;
            try {
              return { type: "image", url: await this.load(part.path) };
            } catch (error) {
              return {
                type: "text",
                text: `[Image attachment: ${part.path}; not embedded: ${error instanceof Error ? error.message : String(error)}]`
              };
            }
          })
        );
      }
    return result;
  }
  async load(path) {
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_IMAGE) throw new Error("requires an image file of at most 20 MiB");
    const stamp = `${info.size}:${info.mtimeMs}`, cached = this.cache.get(path);
    if (cached?.stamp === stamp) return cached.url;
    const file = await open2(path, "r");
    let buffer;
    try {
      const data = Buffer.alloc(Math.min(info.size + 1, MAX_IMAGE + 1));
      let length = 0;
      while (length < data.length) {
        const read = await file.read(data, length, data.length - length, length);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      if (length > MAX_IMAGE) throw new Error("image grew beyond 20 MiB");
      buffer = data.subarray(0, length);
    } finally {
      await file.close();
    }
    const mime = imageMime(buffer);
    if (!mime) throw new Error("unsupported or invalid image signature");
    const url = `data:${mime};base64,${buffer.toString("base64")}`;
    if (cached) {
      this.bytes -= cached.bytes;
      this.cache.delete(path);
    }
    while (this.bytes + buffer.length > 40 * 1024 * 1024 && this.cache.size) {
      const oldest = this.cache.keys().next().value;
      this.bytes -= this.cache.get(oldest).bytes;
      this.cache.delete(oldest);
    }
    this.cache.set(path, { stamp, url, bytes: buffer.length });
    this.bytes += buffer.length;
    return url;
  }
};
function imageMime(data) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString())) return "image/gif";
  if (data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
}

// src/core/text.ts
function cutsSurrogatePair(text2, index) {
  return /[\uD800-\uDBFF]/.test(text2.charAt(index - 1));
}

// src/watch/conversation.ts
var MESSAGE_KINDS = /* @__PURE__ */ new Set(["user_message", "agent_message", "cross_agent_message"]);
var THOUGHT_KIND = "agent_thought";
var SECTION_LIMIT = 8e3;
var ROW_LIMIT = 24e3;
var DISPLAY_LIMIT = 2e3;
var TOOL_LINE_LIMIT = 200;
var TOOL_NAME_LIMIT = 60;
var SNAPSHOT_TAIL = 5;
var SNAPSHOT_BUDGET = 4e5;
function conversationText(text2) {
  return text2.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}
function itemText(item) {
  return typeof item.content.text === "string" ? item.content.text : void 0;
}
function itemAuthor(item) {
  const name = conversationText(item.author?.name ?? "").trim();
  if (name) return name;
  return item.kind === "user_message" ? "Someone in Delta" : "Delta agent";
}
function isMessageItem(item) {
  return MESSAGE_KINDS.has(item.kind) && !!itemText(item)?.trim();
}
function isEventItem(item) {
  return (item.kind === "subthread_event" || item.kind === "land_result") && !!itemText(item)?.trim();
}
function isDrawnItem(item) {
  return isMessageItem(item) || isEventItem(item) || item.kind === "tool_call";
}
function isThoughtItem(item) {
  return item.kind === THOUGHT_KIND && !!itemText(item)?.trim();
}
function itemDisplay(item, thread) {
  if (item.kind === "tool_call") return toolCallDisplay(item);
  if (isEventItem(item)) return personLines("Delta activity:", personParagraphs(eventText(item)), thread);
  const paragraphs = personParagraphs(itemText(item) ?? "");
  if (!paragraphs.length) return;
  if (isThoughtItem(item)) return personLines(`${itemAuthor(item)} (thinking)`, paragraphs, thread);
  if (isMessageItem(item)) return personLines(`${itemAuthor(item)}:`, paragraphs, thread);
}
function personParagraphs(text2) {
  return conversationText(text2).split(/\n\s*\n+/).map((part) => withoutMarkdown(part).replace(/\s+/g, " ").trim()).filter(Boolean);
}
function eventText(item) {
  const text2 = itemText(item) ?? "";
  return (text2.split(/\n<(?:subthread-event|review-thread-event)\b/, 1)[0] ?? "").trim().replace(/:$/, "");
}
function withoutMarkdown(text2) {
  return text2.replace(/^(\s*)#{1,6}\s+/gm, "$1").replace(/\*\*|__|`/g, "").replace(/(^|[\s(])[*_](?=\S)/g, "$1").replace(/(\S)[*_](?=$|[\s.,;:!?)])/g, "$1").replace(/^\s*[-*+]\s+/gm, "\u2022 ").replace(/^\s*>\s?/gm, "");
}
function personLines(label, paragraphs, thread) {
  return [label, ...paragraphs.map((paragraph) => clipWithNote(paragraph, DISPLAY_LIMIT, thread))].join("\n");
}
function readMoreNote(omitted, thread) {
  return ` [\u2026 ${omitted} more characters; read with \`delta thread show ${thread} --format messages --messages 1-20\`]`;
}
function clipWithNote(text2, limit, thread) {
  if (text2.length <= limit) return text2;
  let end = Math.max(0, limit - readMoreNote(text2.length, thread).length);
  if (end < 1) return readMoreNote(text2.length, thread).trim();
  if (cutsSurrogatePair(text2, end)) end--;
  return text2.slice(0, end) + readMoreNote(text2.length - end, thread);
}
function toolCallDisplay(item) {
  const { name, detail, status: status2 } = toolCallParts(item);
  const fixed = `${itemAuthor(item)}: ${name}${status2 ? ` (${status2})` : ""}`;
  const shown = detail ? middleTruncate(detail, TOOL_LINE_LIMIT - fixed.length - 3) : "";
  return `${itemAuthor(item)}: ${name}${shown ? ` \xB7 ${shown}` : ""}${status2 ? ` (${status2})` : ""}`;
}
function toolName(tool) {
  return [tool.title, tool.name].find((value) => typeof value === "string" && !!value.trim()) ?? "tool";
}
function toolCallParts(item) {
  const tool = item.content;
  const status2 = typeof tool.status === "string" && tool.status !== "completed" ? singleLine(tool.status) : void 0;
  const title = singleLine(toolName(tool));
  const input = toolInput(tool.rawInput);
  const detail = input && !describesInput(title, input) ? input : void 0;
  return { name: middleTruncate(title, TOOL_NAME_LIMIT), detail, status: status2 };
}
function describesInput(title, input) {
  return title.includes(input) || title.split(" ").some((word) => word.includes("/") && input.endsWith(`/${word}`));
}
function middleTruncate(text2, width) {
  if (text2.length <= width) return text2;
  if (width < 3) return "";
  let head = Math.floor((width - 1) * 0.4);
  let tail = width - 1 - head;
  if (cutsSurrogatePair(text2, head)) head--;
  if (/[\uDC00-\uDFFF]/.test(text2.charAt(text2.length - tail))) tail--;
  return `${text2.slice(0, head)}\u2026${text2.slice(text2.length - tail)}`;
}
function toolInput(input) {
  if (input === void 0 || input === null) return;
  if (typeof input === "string") return singleLine(input) || void 0;
  if (isJsonObject(input))
    for (const field of ["command", "file_path", "path", "pattern", "query", "url"]) {
      const value = input[field];
      if (typeof value === "string" && value.trim()) return singleLine(value);
    }
  return singleLine(jsonText(input));
}
function singleLine(text2) {
  return conversationText(text2).replace(/\s+/g, " ").trim();
}
async function fingerprint(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes).subarray(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
async function itemFingerprint(item) {
  return fingerprint({ kind: item.kind, content: item.content });
}
function renderItem(item, thread, edited = false) {
  if (item.kind === "unknown" || item.kind === THOUGHT_KIND) return;
  const clip = (text2, limit) => clipForModel(text2, limit, thread);
  let label;
  let body;
  if (item.kind === "tool_call") {
    const tool = item.content;
    label = `tool call ${middleTruncate(singleLine(toolName(tool)), TOOL_LINE_LIMIT)}${typeof tool.status === "string" ? ` (${tool.status})` : ""}`;
    const sections = [];
    if (tool.rawInput !== void 0) sections.push(`Input: ${clip(jsonText(tool.rawInput), 2e3)}`);
    for (const entry of Array.isArray(tool.content) ? tool.content.filter(isJsonObject) : []) {
      if (entry.type === "diff") {
        const patch = typeof entry.patch === "string" ? entry.patch : typeof entry.newText === "string" ? entry.newText : "";
        sections.push(
          `Changed ${typeof entry.path === "string" ? entry.path : "a file"}:
${clip(patch, SECTION_LIMIT)}`
        );
      } else if (entry.type === "terminal")
        sections.push(`Terminal ${typeof entry.terminalId === "string" ? entry.terminalId : ""}`.trim());
      else if (entry.type === "content") {
        const block = entry.content;
        sections.push(
          clip(
            isJsonObject(block) && block.type === "text" && typeof block.text === "string" ? block.text : jsonText(block),
            SECTION_LIMIT
          )
        );
      }
    }
    if (tool.rawOutput !== void 0 && tool.rawOutput !== null)
      sections.push(`Output:
${clip(jsonText(tool.rawOutput), SECTION_LIMIT)}`);
    body = sections.join("\n");
  } else {
    label = item.kind.replace(/_/g, " ");
    const text2 = itemText(item);
    const details = Object.fromEntries(
      Object.entries(item.content).filter(([key]) => text2 === void 0 || key !== "text")
    );
    body = [text2, Object.keys(details).length ? clip(jsonText(details), SECTION_LIMIT) : void 0].filter((part) => part !== void 0).join("\n");
  }
  body = conversationText(body).trim();
  if (!body) return;
  const header = edited ? `[Delta] ${itemAuthor(item)} changed an earlier ${label} (item ${item.id}); it now reads:` : `[Delta] ${itemAuthor(item)}, ${label} (item ${item.id}):`;
  return clip(`${header}
${body}`, ROW_LIMIT);
}
function earlierItemsNotice(count, thread, omitted = 0) {
  const items = `${count} earlier item${count === 1 ? "" : "s"}`;
  const where = omitted >= count ? `${count === 1 ? "is" : "are"} not shown here or in Codex's context` : omitted ? `${count === 1 ? "is" : "are"} not shown here, and the oldest ${omitted} ${omitted === 1 ? "is" : "are"} not in Codex's context either` : `${count === 1 ? "is" : "are"} in Codex's context but not shown here`;
  return `Continuing a Delta thread: ${items} ${where}. Read them with \`delta thread show ${thread} --format messages --messages 1-20\`.`;
}
function omittedItemsRow(count, thread) {
  return `[Delta] ${count} earlier item${count === 1 ? "" : "s"} of this shared thread (messages, tool calls and comments) ${count === 1 ? "was" : "were"} left out of your context to save room; the newest ones follow. If you need them, read them with \`delta thread show ${thread} --format messages --messages 1-20\`; messages are numbered from 1 across the whole thread, at most 20 per call; page forward (21-40, \u2026).`;
}
function removedItemRow(id, item) {
  return `[Delta] An earlier item (item ${id})${item ? ` from ${itemAuthor(item)}` : ""} was removed from the shared thread; disregard it.`;
}
function clipForModel(text2, limit, thread) {
  if (text2.length <= limit) return text2;
  const end = cutsSurrogatePair(text2, limit) ? limit - 1 : limit;
  return text2.slice(0, end) + `
[\u2026 ${text2.length - end} more characters not shown. Read the full text with \`delta thread show ${thread} --format messages --messages 1-20\`; messages are numbered from 1 across the whole thread, at most 20 per call; page forward (21-40, \u2026).]`;
}
function commentKey(id) {
  return `comment:${id}`;
}
function keyedComment(key) {
  return key.startsWith("comment:") ? key.slice("comment:".length) : void 0;
}
function commentAuthor(comment) {
  const creator = commentCreator(comment);
  const others = comment.co_authors.map((person) => conversationText(person.name ?? "").trim()).filter(Boolean);
  return [creator, ...others.filter((name) => name !== creator)].join(", ");
}
function commentCreator(comment) {
  return conversationText(comment.author.name ?? "").trim() || (comment.agent ? "Delta agent" : "Someone in Delta");
}
function commentContextLines(target) {
  if (target?.kind !== "file") return [];
  return target.regions.flatMap((region) => {
    const mark = region.status === "added" ? "+" : region.status === "deleted" ? "-" : " ";
    return conversationText(region.text).split("\n").map((line, index) => `${region.first_line + index} ${mark} ${line}`);
  });
}
async function commentFingerprint(comment, target) {
  const shown = target?.kind === "transcript" ? { ...target, item_id: null } : target ?? null;
  return fingerprint({
    text: comment.text,
    target: shown,
    chain: comment.chain,
    routed_to: comment.routed_to
  });
}
function renderComment(comment, target, thread, edited = false, parent) {
  const text2 = conversationText(comment.text).trim();
  if (!text2) return;
  const author = commentAuthor(comment);
  const reply = comment.chain !== comment.id;
  const label = reply ? "reply to a comment" : "comment";
  const header = edited ? `[Delta] ${author} changed an earlier ${label} (comment ${comment.id}); it now reads:` : `[Delta] ${author}, ${label} (comment ${comment.id}):`;
  const lines = [header];
  if (comment.routed_to) lines.push(`It was sent to the Delta subthread ${comment.routed_to}, not to you.`);
  lines.push("<comments>");
  if (target?.kind === "file") {
    lines.push(`  <file>${escapeMarkup(target.path)}</file>`);
    const context = commentContextLines(target).join("\n");
    if (context)
      lines.push("  <context>", clipForModel(escapeMarkup(context), SECTION_LIMIT, thread), "  </context>");
    if (target.selected)
      lines.push(
        `  <selected>${escapeMarkup(clipForModel(target.selected, SECTION_LIMIT, thread))}</selected>`
      );
  } else if (target?.kind === "transcript" && target.quote.trim()) {
    lines.push(
      `  <context><quote>${escapeMarkup(clipForModel(conversationText(target.quote).trim(), SECTION_LIMIT, thread))}</quote></context>`
    );
  }
  const answered = reply && parent ? conversationText(parent.text).trim() : "";
  if (answered)
    lines.push(
      `  <comment from="${escapeMarkup(commentAuthor(parent))}">${escapeMarkup(clipForModel(answered, SECTION_LIMIT, thread))}</comment>`
    );
  lines.push(`  <comment from="${escapeMarkup(author)}">${escapeMarkup(text2)}</comment>`, "</comments>");
  return clipForModel(lines.join("\n"), ROW_LIMIT, thread);
}
function removedCommentRow(id, comment) {
  return `[Delta] An earlier comment (comment ${id})${comment ? ` from ${commentAuthor(comment)}` : ""} was withdrawn from the shared thread; disregard it.`;
}
function escapeMarkup(text2) {
  return text2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var OMITTED = "omitted";
var OMITTED_ROW = "delta:omitted";
var RemoteView = class {
  constructor(thread, ledger, budget = SNAPSHOT_BUDGET) {
    this.thread = thread;
    this.ledger = ledger;
    this.budget = budget;
  }
  thread;
  ledger;
  budget;
  /** The thread's current items, in the order they first arrived. */
  items = /* @__PURE__ */ new Map();
  comments = /* @__PURE__ */ new Map();
  /** Whether the current connection's snapshot is complete. */
  snapshotDone = false;
  /** Snapshot items added since they were last announced together. */
  quietlyAdded = 0;
  unsettled = /* @__PURE__ */ new Map();
  /** Recent explicit removals survive reconnects, but not a session restart. Older IDs use the placeholder. */
  removed = /* @__PURE__ */ new Set();
  /** The snapshot's newest first-seen items, which alone are drawn for the person. */
  tail = /* @__PURE__ */ new Set();
  /** First-seen snapshot items not drawn, until the notice naming them is offered. */
  hidden = 0;
  /** How many of the hidden items are not in the model's context either. */
  hiddenOmitted = 0;
  /** First-seen snapshot items past the budget, which reach the model only as one row. */
  omitted = /* @__PURE__ */ new Set();
  /** The omitted items whose stand-in row has not been offered yet. */
  omitting = [];
  /** Start a connection's snapshot. */
  reset() {
    this.items = /* @__PURE__ */ new Map();
    this.comments = /* @__PURE__ */ new Map();
    this.unsettled.clear();
    this.deferred = void 0;
    this.snapshotDone = false;
    this.tail.clear();
    this.hidden = 0;
    this.hiddenOmitted = 0;
    this.omitted.clear();
    this.omitting = [];
  }
  upsert(item) {
    this.removed.delete(item.id);
    this.items.set(item.id, item);
    this.mark(item.id, { removed: false, quiet: !this.snapshotDone });
  }
  /** Apply `item.append`, returning the updated item. */
  appendText(id, text2) {
    const item = this.items.get(id);
    if (!item) throw new Error("Delta appended text to an unknown item");
    const updated = { ...item, content: { ...item.content, text: (itemText(item) ?? "") + text2 } };
    this.upsert(updated);
    return updated;
  }
  remove(id) {
    const last = this.items.get(id);
    this.items.delete(id);
    this.forget(id, last);
  }
  upsertComment(comment) {
    const key = commentKey(comment.id);
    this.removed.delete(key);
    this.comments.set(comment.id, comment);
    this.mark(key, { removed: false, quiet: !this.snapshotDone });
  }
  removeComment(id) {
    const last = this.comments.get(id);
    this.comments.delete(id);
    this.forget(commentKey(id), last);
  }
  /** Also queues the correction the model needs if it was shown the item or comment. */
  forget(key, last) {
    this.removed.delete(key);
    this.removed.add(key);
    if (this.removed.size > 4096) this.removed.delete(this.removed.values().next().value);
    this.mark(key, { removed: true, last, quiet: false });
  }
  /** The comment a reply answers, while this view holds it. */
  commentParent(comment) {
    return comment.after_id === null ? void 0 : this.comments.get(comment.after_id);
  }
  /** Only a chain's first comment carries the target. */
  commentTarget(comment) {
    return comment.chain === comment.id ? comment.target : this.comments.get(comment.chain)?.target;
  }
  /** Whether an item, or a comment by its key, was removed during this session. */
  wasRemoved(id) {
    return this.removed.has(id);
  }
  /**
   * End the snapshot; items the model was shown that it no longer has were removed meanwhile. Of the
   * items the model has not seen, only the newest within the budget reach its context, and only the
   * newest few of those are drawn for the person, so joining a long thread does not replay it.
   */
  endSnapshot() {
    this.snapshotDone = true;
    const unseen = [...this.unsettled].flatMap(([id, change]) => {
      if (!change.quiet || this.ledger.items[id] !== void 0) return [];
      const commentId = keyedComment(id);
      if (commentId !== void 0) {
        const comment = this.comments.get(commentId);
        const text3 = comment && renderComment(comment, this.commentTarget(comment), this.thread);
        return text3 === void 0 ? [] : [{ id, text: text3, drawn: true }];
      }
      const item = this.items.get(id);
      const text2 = item && !item.open ? renderItem(item, this.thread) : void 0;
      return text2 === void 0 ? [] : [{ id, text: text2, drawn: isDrawnItem(item) }];
    });
    let used = 0;
    let kept = unseen.length;
    while (kept > 0 && (kept === unseen.length || used + unseen[kept - 1].text.length <= this.budget))
      used += unseen[--kept].text.length;
    this.omitting = unseen.slice(0, kept).map(({ id }) => id);
    this.omitted = new Set(this.omitting);
    const drawn = unseen.filter((entry) => entry.drawn).map(({ id }) => id);
    this.tail = new Set(drawn.filter((id) => !this.omitted.has(id)).slice(-SNAPSHOT_TAIL));
    this.hidden = drawn.length - this.tail.size;
    this.hiddenOmitted = drawn.filter((id) => this.omitted.has(id)).length;
    for (const id of Object.keys(this.ledger.items)) {
      const commentId = keyedComment(id);
      if (commentId === void 0 ? !this.items.has(id) : !this.comments.has(commentId))
        this.mark(id, { removed: true, quiet: false });
    }
  }
  /**
   * Whether no row is needed now. A snapshot adds nothing until it is complete, since which of its
   * items are drawn depends on which are the newest.
   */
  get settled() {
    return !this.snapshotDone || this.unsettled.size === 0 && this.deferred === void 0;
  }
  /** A row taken for the model that had to wait before it was added; it is the next row. */
  deferred;
  /** Keep `row`, taken but not added because rows must wait now, as the next row. */
  defer(row) {
    this.deferred = row;
  }
  /**
   * The next row the model's context needs, oldest change first, or undefined when none is
   * needed yet. Open items wait for completion; a changed or removed item the model was shown gets a
   * correction row.
   */
  async nextRow() {
    const deferred = this.deferred;
    this.deferred = void 0;
    if (deferred) return deferred;
    if (this.snapshotDone && this.omitting.length) {
      const omits = this.omitting;
      this.omitting = [];
      return { id: OMITTED_ROW, text: omittedItemsRow(omits.length, this.thread), quiet: false, omits };
    }
    while (!this.settled) {
      const [id, change] = this.unsettled.entries().next().value;
      this.unsettled.delete(id);
      const known = this.ledger.items[id];
      if (known === OMITTED || this.omitted.has(id)) {
        if (known === OMITTED && change.removed) delete this.ledger.items[id];
        continue;
      }
      const commentId = keyedComment(id);
      if (commentId !== void 0) {
        const row = await this.commentRow(id, commentId, change, known);
        if (row) return row;
        continue;
      }
      const item = change.removed ? void 0 : this.items.get(id);
      if (!item) {
        if (change.removed && known !== void 0)
          return { id, text: removedItemRow(id, change.last), quiet: false };
        continue;
      }
      if (item.open) continue;
      const fingerprint2 = await itemFingerprint(item);
      if (fingerprint2 === known) continue;
      const text2 = renderItem(item, this.thread, known !== void 0);
      if (text2 === void 0) continue;
      const first = known === void 0;
      const quiet = first && change.quiet;
      const commandItem = first && isDrawnItem(item) && (!quiet || this.tail.has(id)) ? id : void 0;
      let announcement = first && !change.quiet && !commandItem ? itemDisplay(item, this.thread) : void 0;
      if (quiet && commandItem && this.hidden) {
        announcement = earlierItemsNotice(this.hidden, this.thread, this.hiddenOmitted);
        this.hidden = 0;
      }
      return { id, text: text2, fingerprint: fingerprint2, commandItem, quiet, announcement };
    }
  }
  async commentRow(key, id, change, known) {
    const comment = change.removed ? void 0 : this.comments.get(id);
    if (!comment) {
      return change.removed && known !== void 0 ? { id: key, text: removedCommentRow(id, change.last), quiet: false } : void 0;
    }
    const target = this.commentTarget(comment);
    const fingerprint2 = await commentFingerprint(comment, target);
    if (fingerprint2 === known) return;
    const text2 = renderComment(comment, target, this.thread, known !== void 0, this.commentParent(comment));
    if (text2 === void 0) return;
    const first = known === void 0;
    const quiet = first && change.quiet;
    const commandItem = first && (!quiet || this.tail.has(key)) ? key : void 0;
    let announcement;
    if (quiet && commandItem && this.hidden) {
      announcement = earlierItemsNotice(this.hidden, this.thread, this.hiddenOmitted);
      this.hidden = 0;
    }
    return { id: key, text: text2, fingerprint: fingerprint2, commandItem, quiet, announcement };
  }
  /** Record that a row was added to Codex's context. */
  commit(row) {
    for (const id of row.omits ?? []) this.ledger.items[id] = OMITTED;
    if (row.fingerprint) this.ledger.items[row.id] = row.fingerprint;
    else delete this.ledger.items[row.id];
  }
  mark(id, change) {
    this.unsettled.delete(id);
    this.unsettled.set(id, change);
  }
};

// src/settings.ts
import { join as join3, isAbsolute } from "node:path";
import { readFile as readFile2, appendFile, mkdir as mkdir2 } from "node:fs/promises";
var NotRepositoryError = class extends Error {
};
async function repository(cwd) {
  const result = await run(["git", "-C", cwd, "rev-parse", "--show-toplevel"]);
  if (result.code !== 0)
    throw new NotRepositoryError(
      "Delta needs a Git checkout. Start Codex inside the repository to share its files."
    );
  return result.stdout.trim();
}
async function readPolicy(cwd) {
  const root = await repository(cwd);
  const value = await readJson(join3(root, ".delta", "settings.json"));
  if (!value) return { mode: "manual" };
  const threads = value.threads;
  if (!threads || !["manual", "private", "organization"].includes(threads.mode) || threads.mode !== "manual" && (typeof threads.organization !== "string" || !threads.organization.trim()))
    throw new Error(
      "Invalid .delta/settings.json: threads.mode must be manual, private or organization; automatic modes need threads.organization. Automatic syncing is disabled."
    );
  return { mode: threads.mode, organization: threads.organization };
}
async function writePolicy(cwd, policy) {
  if (!["manual", "private", "organization"].includes(policy.mode) || policy.mode !== "manual" && !policy.organization?.trim())
    throw new Error("Choose a mode and an organization ID for automatic sync");
  const root = await repository(cwd);
  const tracked = await run(["git", "-C", root, "ls-files", "--", ".delta/settings.json"]);
  if (tracked.stdout.trim())
    throw new Error(
      ".delta/settings.json is tracked by Git. Untrack it before saving a personal automatic-sharing policy."
    );
  const excludeResult = await run(["git", "-C", root, "rev-parse", "--git-path", "info/exclude"]);
  if (excludeResult.code !== 0) throw new Error("Cannot locate Git\u2019s local exclude file");
  const exclude = isAbsolute(excludeResult.stdout.trim()) ? excludeResult.stdout.trim() : join3(root, excludeResult.stdout.trim());
  const current = await readFile2(exclude, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  if (!current.split("\n").includes("/.delta/")) {
    await mkdir2(join3(exclude, ".."), { recursive: true });
    await appendFile(exclude, `${current.endsWith("\n") || !current ? "" : "\n"}/.delta/
`);
  }
  const path = join3(root, ".delta", "settings.json"), previous = await readJson(path);
  await atomicJson(path, { ...previous, threads: policy });
  return { root, policy };
}

// src/bridge.ts
var Bridge = class {
  constructor(directory, delta = new Delta(), codex = new Codex()) {
    this.directory = directory;
    this.delta = delta;
    this.codex = codex;
    if (codex instanceof Codex)
      codex.on("request", (request2) => {
        if (!this.runs.has(request2.params?.threadId)) codex.requests.delete(String(request2.id));
      });
  }
  directory;
  delta;
  codex;
  sessions = /* @__PURE__ */ new Map();
  metadata = /* @__PURE__ */ new Map();
  commands = new Serial();
  timer;
  initializing = /* @__PURE__ */ new Map();
  runs = /* @__PURE__ */ new Set();
  images = new Images();
  notices = /* @__PURE__ */ new Map();
  async start() {
    try {
      const loaded = await this.codex.call("thread/loaded/list", {});
      for (const id of loaded.data ?? []) {
        const saved = await Recording.load(this.directory, id);
        if (saved && !saved.state.stopped) await this.activate(saved).catch(() => {
        });
      }
    } catch {
    }
    this.timer = setInterval(() => {
      for (const runtime of this.sessions.values()) this.schedule(runtime);
    }, 1e3);
    this.timer.unref();
  }
  schedule(runtime) {
    if (runtime.tick || runtime.closing) return runtime.tick;
    runtime.tick = this.tick(runtime).catch((error) => {
      runtime.diagnostic = String(error);
    }).finally(() => {
      runtime.tick = void 0;
    });
    return runtime.tick;
  }
  async tick(runtime) {
    const { recording } = runtime;
    if (runtime.closing || recording.state.stopped) return;
    if (!runtime.ready) {
      await this.prepare(runtime);
    }
    if (!runtime.watch && Date.now() > runtime.lastWatch + 2e3) this.watch(runtime);
    const turns = await this.images.materialize(
      await history(this.codex, recording.state.session, runtime.historyAnchor)
    );
    if (runtime.lastMetadata < Date.now() - 1e4) {
      const metadata = await this.codex.call("thread/read", { threadId: recording.state.session });
      const firstPrompt = turns.flatMap((t) => t.items ?? []).find((i) => i.type === "userMessage")?.content?.find((p) => p.type === "text")?.text;
      const title = metadata.thread?.name || recording.state.title || (typeof firstPrompt === "string" ? firstPrompt.split("\n", 1)[0]?.slice(0, 120) : void 0);
      if (typeof title === "string" && title !== recording.state.title && recording.state.kind === "own")
        await recording.change((s) => {
          stage(s, { sessionUpdate: "session_info_update", title });
          s.title = title;
        });
      runtime.lastMetadata = Date.now();
    }
    const before = digest({ seen: recording.state.seen, active: recording.state.active });
    const draft = structuredClone(recording.state);
    const children = recordTurns(draft, turns);
    if (before !== digest({ seen: draft.seen, active: draft.active }))
      await recording.change((state) => {
        recordTurns(state, turns);
      });
    runtime.historyAnchor = turns.at(-1)?.id ?? runtime.historyAnchor;
    await recording.drain(this.delta, (turn) => this.fence(runtime, turn));
    await this.inject(runtime);
    for (const child of children)
      if (child !== recording.state.session && (runtime.childChecks.get(child) ?? 0) < Date.now() - 1e4) {
        await this.backfillChild(runtime, child);
        runtime.childChecks.set(child, Date.now());
      }
    runtime.initialized = true;
  }
  async backfillChild(parent, id) {
    if (this.sessions.has(id) || this.initializing.has(id)) return;
    const saved = await Recording.load(this.directory, id);
    const metadata = await this.codex.call("thread/read", { threadId: id });
    const cwd = metadata.thread?.cwd;
    if (typeof cwd !== "string") throw new Error("Codex child has no working directory");
    const parentState = parent.recording.state;
    const created = saved ? void 0 : await this.delta.command([
      "thread",
      "create",
      "--source",
      SOURCE,
      "--external-id",
      id,
      "--parent",
      parentState.reference,
      "--name",
      metadata.thread.name || "Codex subagent",
      ...cwd === parentState.cwd ? ["--shared-worktrees"] : []
    ]);
    if (created && (typeof created.thread_id !== "string" || typeof created.reference !== "string"))
      throw new Error("Delta child creation did not return an opaque reference");
    const recording = saved ?? new Recording(Recording.path(this.directory, id), {
      ...freshBinding({
        session: id,
        cwd,
        thread: created.thread_id,
        reference: created.reference,
        kind: "child",
        contract: parentState.contract
      }),
      parent: parentState.session
    });
    if (!saved) await recording.change(() => {
    });
    const turns = await this.images.materialize(await history(this.codex, id));
    const isActive = turns.some((t) => t.status === "inProgress");
    await recording.change((state) => {
      recordTurns(state, turns);
    });
    if (saved?.state.stopped && !isActive) {
      await recording.drain(this.delta, async () => {
      });
      return;
    }
    await recording.change((s) => {
      s.stopped = false;
    });
    const runtime = await this.activate(recording);
    if (!isActive) {
      await recording.drain(this.delta, (turn) => this.fence(runtime, turn));
      if (!recording.state.pending.length) await this.stop(id);
    }
  }
  async activate(recording) {
    const id = recording.state.session;
    if (this.sessions.has(id)) return this.sessions.get(id);
    if (this.initializing.has(id)) return this.initializing.get(id);
    const activation = (async () => {
      const runtime = {
        recording,
        view: new RemoteView(recording.state.reference, structuredClone(recording.state.ledger), 8e4),
        ready: false,
        closing: false,
        rows: new Serial(),
        events: new Serial(),
        fenced: /* @__PURE__ */ new Set(),
        lastWatch: 0,
        initialized: false,
        childChecks: /* @__PURE__ */ new Map(),
        presence: [],
        children: [],
        lastMetadata: 0,
        worktrees: []
      };
      this.sessions.set(id, runtime);
      try {
        await this.prepare(runtime);
      } catch (error) {
        runtime.diagnostic = String(error);
        throw error;
      }
      return runtime;
    })();
    this.initializing.set(id, activation);
    try {
      return await activation;
    } finally {
      this.initializing.delete(id);
    }
  }
  async prepare(runtime) {
    const { recording } = runtime, state = recording.state;
    if (runtime.closing) throw new Error("Delta session activation was cancelled");
    await this.delta.contract();
    await recording.reconcile(this.delta);
    if (runtime.closing) throw new Error("Delta session activation was cancelled");
    if (state.kind === "join") await this.remount(runtime);
    else if (state.kind === "own" || state.worktree || state.kind === "child" && state.parent && this.sessions.get(state.parent)?.recording.state.cwd !== state.cwd) {
      if (!state.worktree) {
        const listed = await this.delta.command(["worktree", "list"]);
        const references = new Set(
          (Array.isArray(listed.worktrees) ? listed.worktrees : []).flatMap(
            (tree) => (tree.directories ?? []).some((d) => d.directory === state.cwd) ? [tree.reference] : []
          )
        );
        if (references.size > 1)
          throw new Error("Multiple Delta worktrees match this checkout; resolve them before sharing");
        const worktree = references.values().next().value ?? (await this.delta.command(["worktree", "create", state.cwd])).reference;
        if (typeof worktree !== "string") throw new Error("Delta did not return a worktree reference");
        await recording.change((s) => {
          s.worktree = worktree;
        });
      }
      await this.delta.command(["worktree", "attach", recording.state.worktree, "--thread", state.reference]);
      const mounted = await this.delta.mount([
        "worktree",
        "mount",
        recording.state.worktree,
        state.cwd,
        "--existing-checkout"
      ]);
      if (runtime.closing) {
        await mounted.process.stop();
        throw new Error("Delta session activation was cancelled");
      }
      if (mounted.value.directory !== state.cwd) {
        await mounted.process.stop();
        throw new Error("Delta mounted an unexpected directory");
      }
      const prior = runtime.mount;
      runtime.mount = mounted.process;
      await prior?.stop();
      void mounted.process.done.catch((error) => {
        runtime.diagnostic = String(error);
      }).finally(() => {
        if (!runtime.closing && runtime.mount === mounted.process) runtime.ready = false;
      });
    }
    runtime.ready = true;
    if (!runtime.watch) this.watch(runtime);
  }
  async remount(runtime) {
    if (runtime.remount) return runtime.remount;
    runtime.remount = (async () => {
      const state = runtime.recording.state;
      const mounted = await this.delta.mount(["thread", "mount", state.reference, "--owner", state.owner]);
      try {
        if (runtime.closing) throw new Error("Delta session mount was cancelled");
        const parsed = parseThreadMount(JSON.stringify(mounted.value), state.owner);
        if (parsed.thread_id !== state.thread || parsed.directory !== state.cwd)
          throw new Error(
            "Joined checkout changed location. Join again to create a fresh Codex session there."
          );
        validateJoinedMounts(await this.delta.status(state.reference, state.session), parsed.worktrees);
        runtime.worktrees = parsed.worktrees;
        const prior = runtime.mount;
        runtime.mount = mounted.process;
        await prior?.stop();
        void mounted.process.done.catch((error) => {
          runtime.diagnostic = String(error);
        }).finally(() => {
          if (!runtime.closing && runtime.mount === mounted.process) runtime.ready = false;
        });
      } catch (error) {
        await mounted.process.stop();
        throw error;
      }
    })();
    try {
      await runtime.remount;
    } finally {
      runtime.remount = void 0;
    }
  }
  watch(runtime) {
    if (runtime.closing) return;
    runtime.view.reset();
    runtime.lastWatch = Date.now();
    const state = runtime.recording.state;
    const watch = this.delta.watch(state.reference, state.session, (line) => {
      let event;
      try {
        event = parseWatchEvent(line);
      } catch (error) {
        runtime.diagnostic = String(error);
        void watch.stop();
        return;
      }
      if (!event) return;
      if (event.type === "producer.turn" && event.status !== "running") {
        const turn = Object.entries(runtime.recording.state.turns).find(
          ([, t]) => t.sequence === event.sequence && !t.finished
        );
        if (turn)
          void this.fence(runtime, turn[0]).catch((error) => {
            runtime.diagnostic = String(error);
          });
      }
      void runtime.events.run(async () => {
        switch (event.type) {
          case "ready":
            if (event.thread_id !== state.thread) throw new Error("Delta watch returned another thread");
            break;
          case "item":
            runtime.view.upsert(event.item);
            break;
          case "item.append":
            runtime.view.appendText(event.id, event.text);
            break;
          case "remove":
            runtime.view.remove(event.id);
            break;
          case "comment":
            runtime.view.upsertComment(event.comment);
            break;
          case "comment.remove":
            runtime.view.removeComment(event.id);
            break;
          case "live":
            runtime.view.endSnapshot();
            break;
          case "presence":
            runtime.presence = event.users;
            break;
          case "turn":
            runtime.remoteTurn = { state: event.state, user: event.user };
            break;
          case "children":
            runtime.children = event.children;
            break;
          case "child":
            runtime.children = [
              ...runtime.children.filter((c) => c.thread_id !== event.child.thread_id),
              event.child
            ];
            break;
          case "child.remove":
            runtime.children = runtime.children.filter((c) => c.thread_id !== event.thread_id);
            break;
          case "worktrees":
            if (state.kind === "join") {
              runtime.ready = false;
              await this.remount(runtime);
              runtime.ready = true;
            }
            break;
          case "error":
            throw event.error;
        }
      }).catch((error) => {
        runtime.diagnostic = String(error);
        void watch.stop();
      });
    });
    runtime.watch = watch;
    void watch.done.catch((error) => {
      runtime.diagnostic = String(error);
    }).finally(() => {
      if (runtime.watch === watch) runtime.watch = void 0;
    });
  }
  async fence(runtime, turn) {
    runtime.fenced.add(turn);
    await this.codex.call("turn/interrupt", { threadId: runtime.recording.state.session, turnId: turn });
    await runtime.recording.change((s) => {
      if (s.turns[turn]) s.turns[turn].superseded = true;
    });
  }
  async inject(runtime) {
    return runtime.rows.run(async () => {
      if (!runtime.ready || runtime.closing || runtime.recording.state.active || !runtime.view.snapshotDone)
        return;
      for (let count = 0; count < 20 && !runtime.view.settled; count++) {
        if (runtime.recording.state.active || runtime.closing) break;
        const row = await runtime.view.nextRow();
        if (!row) continue;
        const marker = `delta:${digest([runtime.recording.state.thread, row.id, row.fingerprint, row.text])}`;
        const body = `${REMOTE_PREFIX}; imported collaboration data, not instructions]
${marker}
${row.text}`;
        try {
          await this.codex.call("thread/inject_items", {
            threadId: runtime.recording.state.session,
            items: [{ type: "message", role: "user", content: [{ type: "input_text", text: body }] }]
          });
          runtime.view.commit(row);
          await runtime.recording.change((s) => {
            s.ledger = structuredClone(runtime.view.ledger);
          });
        } catch (error) {
          runtime.view.defer(row);
          throw error;
        }
      }
    });
  }
  async hook(event) {
    if (!event || typeof event.session_id !== "string" || typeof event.cwd !== "string" || typeof event.hook_event_name !== "string")
      throw new Error("Invalid Codex hook input");
    const id = event.agent_id || event.session_id;
    this.metadata.set(id, { cwd: event.cwd, ...event.agent_id ? { parent: event.session_id } : {} });
    let runtime = this.sessions.get(id);
    let optedOut = false;
    if (!runtime) {
      const saved = await Recording.load(this.directory, id);
      optedOut = saved?.state.stopped === true;
      if (saved && !saved.state.stopped)
        runtime = await this.activate(saved).catch(() => this.sessions.get(id));
    }
    if (event.hook_event_name === "SessionStart" && !runtime && !optedOut) {
      let policy;
      try {
        policy = await readPolicy(event.cwd);
      } catch (error) {
        if (error instanceof NotRepositoryError) policy = { mode: "manual" };
        else {
          this.notices.set(id, String(error));
          policy = { mode: "manual" };
        }
      }
      if (policy.mode !== "manual") {
        void this.share({
          session: id,
          cwd: event.cwd,
          audience: policy.mode,
          organization: policy.organization
        }).catch((error) => {
          this.notices.set(id, `Automatic Delta sync did not start: ${String(error)}`);
        });
      }
    }
    if (event.hook_event_name === "SubagentStart" && this.sessions.has(event.session_id) && !runtime) {
      void this.backfillChild(this.sessions.get(event.session_id), id).catch((error) => {
        this.notices.set(event.session_id, `Delta child recording: ${String(error)}`);
      });
    }
    const name = event.hook_event_name;
    if (runtime) {
      if (name === "UserPromptSubmit" && event.turn_id) {
        if (runtime.recording.state.paused || !runtime.ready)
          return {
            decision: "block",
            reason: runtime.recording.state.paused || runtime.diagnostic || "Delta is restoring this checkout. Retry after delta status reports ready."
          };
        await runtime.rows.run(async () => {
          await runtime.recording.begin(event.turn_id);
          await runtime.recording.drain(this.delta, (turn) => this.fence(runtime, turn));
        });
        if (runtime.recording.state.paused)
          return { decision: "block", reason: runtime.recording.state.paused };
      }
      if (name === "PreToolUse" && event.turn_id && (runtime.fenced.has(event.turn_id) || runtime.recording.state.turns[event.turn_id]?.superseded || runtime.recording.state.kind === "join" && (!runtime.ready || !runtime.watch)))
        return {
          hookSpecificOutput: {
            hookEventName: name,
            permissionDecision: "deny",
            permissionDecisionReason: "A collaborator took over this Delta turn."
          }
        };
      if (["Stop", "SubagentStop", "Interrupt"].includes(name)) {
        this.schedule(runtime);
        if (event.turn_id && name === "Interrupt")
          void runtime.recording.finish(event.turn_id, "cancelled").catch(() => {
          });
      }
      if (name === "PostToolUse" && event.tool_name?.split(".").at(-1) === "update_plan" && runtime.recording.state.contract >= 10 && event.turn_id) {
        const plan = event.tool_input?.plan;
        if (Array.isArray(plan))
          await runtime.recording.change((state) => {
            const sequence = state.turns[event.turn_id]?.sequence;
            if (sequence)
              stage(
                state,
                {
                  sessionUpdate: "plan_update",
                  plan: {
                    type: "items",
                    planId: "plan",
                    entries: plan.filter(
                      (p) => typeof p.step === "string" && ["pending", "in_progress", "completed"].includes(p.status)
                    ).map((p) => ({ content: p.step, priority: "medium", status: p.status }))
                  }
                },
                sequence
              );
          });
      }
      if (name === "SessionEnd") {
        void this.stop(id, false).catch(() => {
        });
        return {};
      }
    }
    if (name === "SessionStart")
      return {
        hookSpecificOutput: {
          hookEventName: name,
          additionalContext: `Delta for Codex is available. The current Codex session ID is ${id}. Use this exact ID with the Delta skill's --session option. Sharing is opt-in unless this repository has an explicit Delta sync policy.`
        },
        ...runtime?.diagnostic || this.notices.has(id) ? { systemMessage: runtime?.diagnostic || this.notices.get(id) } : {}
      };
    if (this.notices.has(id)) {
      const message = this.notices.get(id);
      this.notices.delete(id);
      return { systemMessage: message };
    }
    return {};
  }
  async share(input) {
    return this.commands.run(async () => {
      if (!["private", "organization", "invite"].includes(input.audience))
        throw new Error("Choose private, organization, or invite explicitly");
      if (input.audience === "invite" && !input.emails?.length)
        throw new Error("Invite requires email recipients");
      const contract = await this.delta.contract(), cwd = await repository(input.cwd);
      const metadata = await this.codex.call("thread/read", { threadId: input.session });
      if (typeof metadata.thread?.cwd !== "string" || await repository(metadata.thread.cwd) !== cwd)
        throw new Error("The selected Codex session belongs to a different checkout");
      let recording = this.sessions.get(input.session)?.recording ?? await Recording.load(this.directory, input.session);
      if (recording && recording.state.cwd !== cwd)
        throw new Error("This session is bound to a different checkout; use a new Codex session");
      if (!recording) {
        if (!input.organization)
          throw new Error(
            "Select a Delta organization ID. Run delta org list; personal organizations support private sync too."
          );
        const created = await this.delta.command([
          "thread",
          "create",
          "--source",
          SOURCE,
          "--external-id",
          input.session,
          "--organization",
          input.organization,
          "--visibility",
          "private"
        ]);
        if (typeof created.thread_id !== "string") throw new Error("Delta did not return a thread ID");
        recording = new Recording(Recording.path(this.directory, input.session), {
          ...freshBinding({
            session: input.session,
            cwd,
            thread: created.thread_id,
            reference: typeof created.reference === "string" ? created.reference : created.thread_id,
            kind: "own",
            contract
          }),
          organization: input.organization
        });
        await recording.change(() => {
        });
      }
      if (input.audience === "private") {
        const status3 = await this.delta.status(recording.state.reference, input.session);
        if (status3.visibility && status3.visibility !== "private")
          throw new Error("This thread is already shared; Delta cannot make it private again");
      }
      await recording.change((s) => {
        s.stopped = false;
      });
      const runtime = await this.activate(recording);
      if (!runtime.ready) await this.prepare(runtime);
      await this.schedule(runtime);
      if (!runtime.initialized)
        throw new Error(runtime.diagnostic || "Codex history has not been captured yet");
      if (runtime.closing) throw new Error("Sharing was cancelled before the audience changed");
      if (recording.state.paused) throw new Error(recording.state.paused);
      let results;
      if (input.audience === "organization")
        await this.delta.command([
          "thread",
          "share",
          recording.state.reference,
          "--visibility",
          "organization"
        ]);
      if (input.audience === "invite")
        results = await this.delta.command([
          "thread",
          "invite",
          recording.state.reference,
          "--",
          ...input.emails
        ]);
      const status2 = await this.delta.status(recording.state.reference, input.session);
      await recording.change((s) => {
        s.url = status2.url ?? void 0;
        s.visibility = status2.visibility ?? void 0;
      });
      return { ...this.status(input.session), ...results ? { invitations: results } : {} };
    });
  }
  async join(reference, startOptions = {}) {
    await this.delta.contract();
    const owner = `codex-${randomUUID2()}`;
    const access = await this.delta.status(reference, owner);
    if (access.access.state !== "granted") throw new Error("Delta has not granted access to this thread");
    const mounted = await this.delta.mount(["thread", "mount", reference, "--owner", owner, "--join"]);
    try {
      const value = parseThreadMount(JSON.stringify(mounted.value), owner);
      if (value.thread_id !== access.thread_id) throw new Error("Delta mounted a different thread");
      validateJoinedMounts(await this.delta.status(reference, owner), value.worktrees);
      const started = await this.codex.call("thread/start", {
        ...startOptions,
        cwd: value.directory,
        runtimeWorkspaceRoots: value.worktrees.map((tree) => tree.directory),
        serviceName: "delta-codex"
      });
      const id = started.thread?.id;
      if (typeof id !== "string") throw new Error("Codex did not return a new session ID");
      const recording = new Recording(Recording.path(this.directory, id), {
        ...freshBinding({
          session: id,
          cwd: value.directory,
          thread: value.thread_id,
          reference,
          kind: "join",
          contract: await this.delta.contract()
        }),
        owner,
        url: access.url ?? void 0
      });
      await recording.change(() => {
      });
      const runtime = await this.activate(recording);
      await deadline(
        (async () => {
          while (!runtime.view.snapshotDone) {
            if (!runtime.watch)
              throw new Error(runtime.diagnostic || "Delta watch disconnected before its snapshot");
            await new Promise((resolve2) => setTimeout(resolve2, 50));
          }
        })(),
        3e4,
        "Delta history"
      );
      await this.inject(runtime);
      return {
        session: id,
        directory: value.directory,
        url: access.url,
        resume: ["codex", "-C", value.directory, "resume", id]
      };
    } finally {
      await mounted.process.stop();
    }
  }
  status(session) {
    const summarize = (r) => ({
      session: r.recording.state.session,
      thread: r.recording.state.thread,
      reference: r.recording.state.reference,
      cwd: r.recording.state.cwd,
      url: r.recording.state.url,
      visibility: r.recording.state.visibility,
      ready: r.ready,
      pending: r.recording.state.pending.length,
      activeTurn: r.recording.state.active,
      paused: r.recording.state.paused,
      diagnostic: r.diagnostic,
      contract: r.recording.state.contract,
      title: r.recording.state.title,
      presence: r.presence,
      children: r.children,
      remoteTurn: r.remoteTurn
    });
    if (session) {
      const runtime = this.sessions.get(session);
      return runtime ? summarize(runtime) : { session, recording: false };
    }
    return { sessions: [...this.sessions.values()].map(summarize) };
  }
  async inspect(session) {
    if (!session || this.sessions.has(session)) return this.status(session);
    const saved = await Recording.load(this.directory, session);
    return saved ? {
      session,
      thread: saved.state.thread,
      cwd: saved.state.cwd,
      url: saved.state.url,
      recording: false,
      stopped: !!saved.state.stopped,
      pending: saved.state.pending.length,
      paused: saved.state.paused,
      diagnostic: this.notices.get(session)
    } : this.status(session);
  }
  async retry(id) {
    const saved = this.sessions.get(id)?.recording ?? await Recording.load(this.directory, id);
    if (!saved) throw new Error("No recording for this session");
    await saved.reconcile(this.delta);
    await saved.change((s) => {
      delete s.paused;
      delete s.retryAt;
      s.stopped = false;
    });
    const runtime = await this.activate(saved);
    await this.prepare(runtime);
    await this.schedule(runtime);
    return this.status(id);
  }
  async recover(id, action) {
    const recording = this.sessions.get(id)?.recording ?? await Recording.load(this.directory, id);
    if (!recording) throw new Error("No Delta recording for this session");
    let kept = recording.state.fork;
    if (action === "fork" && !kept) {
      const result = await this.delta.command(["thread", "fork", recording.state.reference]);
      if (typeof result.thread_id !== "string")
        throw new Error("Delta did not confirm the recovery fork; nothing was discarded");
      kept = result.thread_id;
      await recording.change((s) => {
        s.fork = kept;
      });
    }
    await this.delta.command(["thread", "discard", recording.state.reference, "--force"]);
    await this.stop(id);
    return {
      keptThread: kept,
      next: "Join the kept thread (or original after discard) in a fresh Codex session. The original local outbox is retained."
    };
  }
  async stop(id, optOut = true) {
    const runtime = this.sessions.get(id);
    if (!runtime) {
      const saved = await Recording.load(this.directory, id);
      if (saved && optOut)
        await saved.change((s) => {
          s.stopped = true;
        });
      return;
    }
    runtime.closing = true;
    await runtime.tick?.catch(() => {
    });
    for (const child of [...this.sessions.values()].filter((r) => r.recording.state.parent === id))
      await this.stop(child.recording.state.session, optOut);
    if (runtime.recording.state.kind === "join") await this.interruptBeforeUnmount(runtime);
    try {
      const turns = await this.images.materialize(await history(this.codex, id));
      await runtime.recording.change((s) => {
        recordTurns(s, turns);
      });
      await runtime.recording.drain(this.delta, (turn) => this.fence(runtime, turn));
    } catch (error) {
      runtime.diagnostic = String(error);
    }
    if (optOut)
      await runtime.recording.change((s) => {
        s.stopped = true;
      });
    await Promise.allSettled([runtime.watch?.stop(), runtime.mount?.stop()]);
    this.sessions.delete(id);
  }
  async setup(cwd, policy) {
    return writePolicy(cwd, policy);
  }
  async branch(session, name, isolated) {
    const parent = this.sessions.get(session)?.recording.state;
    if (!parent) throw new Error("Share the parent session before creating a Delta child");
    if (!name.trim()) throw new Error("A child thread needs a name");
    const created = await this.delta.command([
      "thread",
      "create",
      "--source",
      SOURCE,
      "--external-id",
      `branch-${digest([session, name, isolated]).slice(0, 32)}`,
      "--parent",
      parent.reference,
      "--name",
      name,
      isolated ? "--isolated-worktrees" : "--shared-worktrees"
    ]);
    if (typeof created.reference !== "string")
      throw new Error("Delta did not return an opaque child reference");
    return created;
  }
  /** Background thread execution uses the same daemon; permissions never exceed the parent's sandbox. */
  async runThread(parentSession, reference, prompt, write = false) {
    if (!prompt.trim()) throw new Error("A thread run needs a prompt");
    if (!this.sessions.has(parentSession))
      throw new Error("Share the parent session before running a Delta thread");
    const target = await this.delta.status(reference, parentSession);
    if (target.thread_id === this.sessions.get(parentSession).recording.state.thread)
      throw new Error(
        "Run a child or another Delta thread; running the parent thread would take over your current turn"
      );
    const parent = await this.codex.call("thread/resume", { threadId: parentSession, excludeTurns: true });
    const policy = parent.sandbox?.type;
    const profile = parent.activePermissionProfile?.id;
    if (!["readOnly", "workspaceWrite", "dangerFullAccess"].includes(policy) || profile && !profile.startsWith(":"))
      throw new Error(
        "This parent uses a custom permission policy. Open the Delta thread in an interactive Codex session to run it."
      );
    if (write && policy === "readOnly")
      throw new Error("The parent is read-only; this child cannot gain write access");
    const joined = await this.join(reference, {
      sandbox: write ? "workspace-write" : "read-only",
      approvalPolicy: parent.approvalPolicy,
      approvalsReviewer: "user",
      model: parent.model,
      modelProvider: parent.modelProvider
    });
    await this.sessions.get(joined.session).recording.change((s) => {
      s.parent = parentSession;
    });
    const sandboxPolicy = write ? {
      type: "workspaceWrite",
      writableRoots: this.sessions.get(joined.session).worktrees.map((tree) => tree.directory),
      networkAccess: false,
      excludeTmpdirEnvVar: true,
      excludeSlashTmp: true
    } : { type: "readOnly", networkAccess: false };
    this.runs.add(joined.session);
    try {
      const result = await this.codex.call("turn/start", {
        threadId: joined.session,
        sandboxPolicy,
        input: [{ type: "text", text: prompt }],
        parentTurnId: this.sessions.get(parentSession)?.recording.state.active
      });
      return {
        ...joined,
        turn: result.turn.id,
        status: result.turn.status,
        approval: "Inspect pending requests; only an explicit answer can approve an operation."
      };
    } catch (error) {
      this.runs.delete(joined.session);
      throw new Error(
        `Codex run did not start in session ${joined.session}: ${String(error)}. Inspect that session before retrying.`
      );
    }
  }
  async send(session, turn, prompt) {
    if (!this.sessions.has(session)) throw new Error("This session is not connected to Delta");
    return this.codex.call("turn/steer", {
      threadId: session,
      expectedTurnId: turn,
      input: [{ type: "text", text: prompt }]
    });
  }
  async interrupt(session, turn) {
    if (!this.sessions.has(session)) throw new Error("This session is not connected to Delta");
    return this.codex.call("turn/interrupt", { threadId: session, turnId: turn });
  }
  pending(session) {
    if (!(this.codex instanceof Codex)) return [];
    return [...this.codex.requests].filter(([, r]) => this.runs.has(r.params?.threadId) && (!session || r.params?.threadId === session)).map(([id, r]) => ({ id, method: r.method, details: r.params }));
  }
  answer(id, decision, answers) {
    if (!(this.codex instanceof Codex)) throw new Error("No native approval connection");
    const pending = this.codex.requests.get(id);
    if (!pending || !this.runs.has(pending.params?.threadId))
      throw new Error("No pending request owned by this Delta run");
    if (["item/commandExecution/requestApproval", "item/fileChange/requestApproval"].includes(pending.method)) {
      if (decision !== "accept" && decision !== "decline")
        throw new Error("Choose accept or decline for this specific operation");
      this.codex.respond(id, { decision });
    } else if (pending.method === "item/tool/requestUserInput") {
      if (!answers || !Object.values(answers).every(
        (a) => Array.isArray(a.answers) && a.answers.every((s) => typeof s === "string")
      ))
        throw new Error('Provide question IDs mapped to { answers: ["answer"] }');
      this.codex.respond(id, { answers });
    } else if (pending.method === "item/permissions/requestApproval" && decision === "decline") {
      this.codex.respond(id, { permissions: {}, scope: "turn" });
    } else throw new Error("This request needs an interactive Codex client; it has not been approved");
    return { answered: id };
  }
  async wait(session, seconds) {
    if (!this.sessions.has(session)) throw new Error("This session is not connected to Delta");
    const end = Date.now() + Math.max(0, Math.min(seconds, 50)) * 1e3;
    for (; ; ) {
      const pending = this.pending(session);
      const turns = await history(this.codex, session, this.sessions.get(session)?.historyAnchor);
      const turn = turns.at(-1);
      if (pending.length || turn?.status !== "inProgress" || Date.now() >= end)
        return {
          session,
          turn: turn?.id,
          status: turn?.status ?? "idle",
          pending,
          response: turn?.items.filter((i) => i.type === "agentMessage").map((i) => i.text).join("\n\n")
        };
      await new Promise((resolve2) => setTimeout(resolve2, 250));
    }
  }
  async close() {
    clearInterval(this.timer);
    for (const runtime of this.sessions.values()) runtime.closing = true;
    await Promise.allSettled(
      [...this.sessions.values()].filter((r) => r.recording.state.kind === "join").map((r) => this.interruptBeforeUnmount(r))
    );
    await Promise.allSettled([...this.sessions.values()].flatMap((r) => [r.watch?.stop(), r.mount?.stop()]));
    if (this.codex instanceof Codex) await this.codex.close();
  }
  async interruptBeforeUnmount(runtime) {
    const id = runtime.recording.state.session;
    try {
      const turns = await history(this.codex, id, runtime.historyAnchor);
      const active = turns.find((t) => t.status === "inProgress");
      if (active) await this.codex.call("turn/interrupt", { threadId: id, turnId: active.id }, 2500);
    } catch (error) {
      runtime.diagnostic = `Could not confirm turn cancellation before mount shutdown: ${String(error)}`;
    }
  }
};

// src/ipc.ts
var endpointFile = (directory) => join4(directory, "bridge.json");
function readFrame(socket, onValue) {
  let pending = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    pending += chunk;
    if (pending.length > MAX_FRAME) {
      socket.destroy(new Error("IPC request too large"));
      return;
    }
    const newline = pending.indexOf("\n");
    if (newline < 0) return;
    const frame = pending.slice(0, newline);
    pending = "";
    try {
      onValue(JSON.parse(frame));
    } catch {
      socket.destroy();
    }
  });
}
async function request(directory, message, timeout = 18e4) {
  const endpoint = await readJson(endpointFile(directory));
  if (!endpoint || endpoint.version !== 1) throw new Error("Delta bridge is not running");
  if (process.platform !== "win32") {
    const info = await lstat(endpointFile(directory));
    if (info.isSymbolicLink() || info.mode & 63 || info.uid !== process.getuid?.())
      throw new Error("Insecure Delta bridge endpoint permissions");
  }
  return new Promise((resolve2, reject) => {
    const socket = createConnection(endpoint.socket);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Delta bridge request timed out; inspect status before retrying a mutation"));
    }, timeout);
    const finish = () => clearTimeout(timer);
    socket.once("error", (error) => {
      finish();
      reject(error);
    });
    socket.once("connect", () => socket.write(JSON.stringify({ token: endpoint.token, ...message }) + "\n"));
    let received = false;
    socket.once("close", () => {
      finish();
      if (!received)
        reject(new Error("Delta bridge disconnected before replying; inspect status before retrying"));
    });
    readFrame(socket, (value) => {
      received = true;
      finish();
      socket.end();
      value.error ? reject(new Error(value.error)) : resolve2(value.result);
    });
  });
}
async function ensureBridge(directory, entrypoint) {
  try {
    await request(directory, { method: "ping", params: {} }, 1e3);
    return;
  } catch {
  }
  const child = spawn3(process.execPath, [entrypoint, "serve"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, DELTA_CODEX_HOME: directory }
  });
  child.on("error", () => {
  });
  child.unref();
  await deadline(
    (async () => {
      for (; ; ) {
        try {
          await request(directory, { method: "ping", params: {} }, 500);
          return;
        } catch {
          await new Promise((resolve2) => setTimeout(resolve2, 50));
        }
      }
    })(),
    1e4,
    "Starting Delta bridge"
  );
}
async function serve(directory) {
  await mkdir3(directory, { recursive: true, mode: 448 });
  if (process.platform !== "win32") await chmod(directory, 448);
  const lockPath = join4(directory, "bridge.lock");
  let lock;
  try {
    lock = await open3(lockPath, "wx", 384);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const owner = await readJson(lockPath).catch(() => void 0);
    if (!owner && Date.now() - (await stat2(lockPath)).mtimeMs < 1e4) return;
    if (owner)
      try {
        process.kill(owner.pid, 0);
        return;
      } catch (error2) {
        if (error2.code !== "ESRCH") return;
      }
    let claim;
    try {
      claim = await open3(`${lockPath}.recovery`, "wx", 384);
    } catch {
      return;
    }
    try {
      await unlink2(lockPath);
      lock = await open3(lockPath, "wx", 384);
    } finally {
      await claim.close();
      await unlink2(`${lockPath}.recovery`).catch(() => {
      });
    }
  }
  await lock.writeFile(JSON.stringify({ pid: process.pid }));
  await lock.sync();
  const token = randomBytes(32).toString("hex");
  const socketDirectory = join4(tmpdir(), `delta-codex-${digest(directory).slice(0, 20)}`);
  await mkdir3(socketDirectory, { recursive: true, mode: 448 });
  if (process.platform !== "win32") {
    const info = await lstat(socketDirectory);
    if (info.isSymbolicLink() || info.uid !== process.getuid?.() || info.mode & 63)
      throw new Error("Insecure Delta socket directory");
  }
  const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\delta-codex-${digest(directory).slice(0, 24)}` : join4(socketDirectory, "bridge.sock");
  if (process.platform !== "win32") await unlink2(socketPath).catch(() => {
  });
  const bridge = new Bridge(directory);
  const server = createServer((socket) => {
    socket.on("error", () => {
    });
    socket.setTimeout(18e4, () => socket.destroy());
    let handled = false;
    readFrame(socket, (value) => {
      if (handled) return;
      handled = true;
      const supplied = Buffer.from(typeof value.token === "string" ? value.token : "");
      if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) {
        socket.end(JSON.stringify({ error: "Unauthorized local request" }) + "\n");
        return;
      }
      void dispatch(bridge, value, () => {
        setTimeout(() => void close(), 10);
      }).then(
        (result) => socket.end(JSON.stringify({ result }) + "\n"),
        (error) => socket.end(
          JSON.stringify({ error: String(error instanceof Error ? error.message : error) }) + "\n"
        )
      );
    });
  });
  await new Promise((resolve2, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve2);
  });
  if (process.platform !== "win32") await chmod(socketPath, 384);
  await atomicJson(endpointFile(directory), { token, socket: socketPath, pid: process.pid, version: 1 });
  void bridge.start().catch(() => {
  });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    server.close();
    await bridge.close();
    await unlink2(endpointFile(directory)).catch(() => {
    });
    await lock.close();
    await unlink2(lockPath).catch(() => {
    });
    process.exit(0);
  };
  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
}
async function dispatch(bridge, request2, shutdown) {
  const p = request2.params ?? {};
  switch (request2.method) {
    case "ping":
      return { version: "0.1.0", pid: process.pid };
    case "shutdown":
      shutdown?.();
      return { stopping: true };
    case "hook":
      return bridge.hook(p);
    case "share":
      return bridge.share(p);
    case "join":
      return bridge.join(p.reference);
    case "status":
      return bridge.inspect(p.session);
    case "setup":
      return bridge.setup(p.cwd, p.policy);
    case "retry":
      return bridge.retry(p.session);
    case "stop":
      await bridge.stop(p.session);
      return { stopped: p.session };
    case "resolve":
      return bridge.recover(p.session, p.action);
    case "branch":
      return bridge.branch(p.session, p.name, p.isolated);
    case "run":
      return bridge.runThread(p.session, p.reference, p.prompt, p.write);
    case "send":
      return bridge.send(p.session, p.turn, p.prompt);
    case "interrupt":
      return bridge.interrupt(p.session, p.turn);
    case "pending":
      return bridge.pending(p.session);
    case "answer":
      return bridge.answer(p.id, p.decision, p.answers);
    case "wait":
      return bridge.wait(p.session, p.seconds);
    default:
      throw new Error(`Unknown Delta bridge operation: ${request2.method}`);
  }
}

// src/main.ts
import { readFile as readFile3 } from "node:fs/promises";
var hookEvent;
var HELP = `Delta for Codex 0.1.0

  delta-codex doctor
  delta-codex bridge-stop
  delta-codex setup --mode manual|private|organization [--org ID] [--cwd PATH]
  delta-codex share --session CODEX_ID --audience private|organization|invite --org ID [--email ADDRESS ...]
  delta-codex join THREAD_OR_LINK
  delta-codex status [--session CODEX_ID]
  delta-codex retry --session CODEX_ID
  delta-codex stop --session CODEX_ID
  delta-codex resolve --session CODEX_ID --action fork|discard --confirm
  delta-codex auth status|login
  delta-codex org list|current|switch ID|create NAME|invite EMAIL ... [--org ID]
  delta-codex search QUERY | show THREAD | tree THREAD
  delta-codex fork THREAD | merge CHILD --into PARENT --confirm
  delta-codex update [--check]
  delta-codex branch --session PARENT --name NAME [--isolated]
  delta-codex run THREAD --session PARENT --prompt TEXT [--write]
  delta-codex send --session CHILD --turn TURN_ID --prompt TEXT
  delta-codex wait --session CHILD [--seconds 30]
  delta-codex interrupt --session CHILD --turn TURN_ID
  delta-codex pending [--session CHILD]
  delta-codex answer --request ID --decision accept|decline

All results are JSON. Hooks are trusted through Codex /hooks. Sharing includes
conversation, tool inputs/outputs, visible reasoning, and nonignored checkout files.
Never use the most recent session as a substitute for the current session ID.
Environment: DELTA_CODEX_HOME, DELTA_CODEX_DELTA_BIN, DELTA_CODEX_CODEX_BIN.
`;
async function main() {
  const { values: flags, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
      session: { type: "string" },
      cwd: { type: "string" },
      audience: { type: "string" },
      org: { type: "string" },
      email: { type: "string", multiple: true },
      mode: { type: "string" },
      action: { type: "string" },
      confirm: { type: "boolean" },
      check: { type: "boolean" },
      into: { type: "string" },
      name: { type: "string" },
      isolated: { type: "boolean" },
      prompt: { type: "string" },
      write: { type: "boolean" },
      turn: { type: "string" },
      seconds: { type: "string" },
      request: { type: "string" },
      decision: { type: "string" },
      "answers-file": { type: "string" }
    }
  });
  const [command, ...args] = positionals;
  if (flags.version) {
    console.log("0.1.0");
    return;
  }
  if (!command || flags.help) {
    console.log(HELP);
    return;
  }
  const directory = dataDirectory(), delta = new Delta(), cwd = resolve(flags.cwd ?? process.cwd());
  const session = () => {
    const value = flags.session || process.env.CODEX_THREAD_ID;
    if (!value)
      throw new Error(
        "Pass --session with the current Codex session ID from the SessionStart hook or CODEX_THREAD_ID. No session is guessed."
      );
    return value;
  };
  const first = () => {
    if (!args[0] || args[0].startsWith("-")) throw new Error(`${command} needs an explicit argument`);
    return args[0];
  };
  const call = async (method, params, timeout) => {
    await ensureBridge(directory, fileURLToPath(import.meta.url));
    return request(directory, { method, params }, timeout);
  };
  let result;
  switch (command) {
    case "serve":
      await serve(directory);
      return;
    case "bridge-stop":
      result = await request(directory, { method: "shutdown", params: {} }, 3e3);
      break;
    case "hook": {
      let input = "";
      for await (const chunk of process.stdin) {
        input += chunk.toString();
        if (input.length > MAX_FRAME) throw new Error("Hook payload too large");
      }
      const event = hookEvent = JSON.parse(input);
      result = ["Interrupt", "SessionEnd"].includes(event.hook_event_name) ? await request(directory, { method: "hook", params: event }, 1800) : await call("hook", event, 25e3);
      break;
    }
    case "doctor": {
      const checks = await Promise.allSettled([
        run([delta.executable, "--version"]),
        run([process.env.DELTA_CODEX_CODEX_BIN || "codex", "--version"]),
        delta.contract()
      ]);
      const rpc = new Codex();
      let daemon;
      try {
        daemon = await rpc.call("thread/loaded/list", {}, 5e3);
      } catch (error) {
        daemon = { error: String(error) };
      } finally {
        await rpc.close();
      }
      result = {
        node: process.version,
        dataDirectory: directory,
        checks: checks.map((c, i) => ({
          name: ["delta", "codex", "contract"][i],
          ...c.status === "fulfilled" ? { value: c.value } : { error: String(c.reason) }
        })),
        daemon,
        guidance: "Requires Codex 0.166.0+ with shared daemon and trusted hooks, Delta contract 8\u201310, and Node 22.19+. No login or upload is performed by doctor."
      };
      break;
    }
    case "setup": {
      if (!flags.mode || !["manual", "private", "organization"].includes(flags.mode))
        throw new Error("Choose --mode manual, private or organization");
      result = await writePolicy(cwd, {
        mode: flags.mode,
        organization: flags.org
      });
      break;
    }
    case "share":
      result = await call("share", {
        session: session(),
        cwd,
        audience: flags.audience,
        organization: flags.org,
        emails: flags.email
      });
      break;
    case "join":
      result = await call("join", { reference: first() });
      break;
    case "status":
      result = await call("status", { session: flags.session });
      break;
    case "retry":
    case "stop":
      result = await call(command, { session: session() });
      break;
    case "branch":
      if (!flags.name) throw new Error("Choose --name for the new Delta child");
      result = await call("branch", { session: session(), name: flags.name, isolated: !!flags.isolated });
      break;
    case "run":
      if (!flags.prompt) throw new Error("Provide --prompt for the background run");
      result = await call("run", {
        session: session(),
        reference: first(),
        prompt: flags.prompt,
        write: !!flags.write
      });
      break;
    case "send":
    case "interrupt":
      if (!flags.turn || command === "send" && !flags.prompt)
        throw new Error("Provide --turn and a --prompt for send");
      result = await call(command, { session: session(), turn: flags.turn, prompt: flags.prompt });
      break;
    case "wait":
      if (flags.seconds && (!Number.isFinite(Number(flags.seconds)) || Number(flags.seconds) < 0 || Number(flags.seconds) > 50))
        throw new Error("--seconds must be between 0 and 50");
      result = await call("wait", { session: session(), seconds: Number(flags.seconds ?? 30) });
      break;
    case "pending":
      result = await call("pending", { session: flags.session });
      break;
    case "answer":
      if (!flags.request) throw new Error("Provide --request for the pending request ID");
      result = await call("answer", {
        id: flags.request,
        decision: flags.decision,
        answers: flags["answers-file"] ? JSON.parse(await readFile3(flags["answers-file"], "utf8")) : void 0
      });
      break;
    case "resolve":
      if (!flags.confirm || !["fork", "discard"].includes(flags.action ?? ""))
        throw new Error(
          "Recovery needs --action fork|discard --confirm. Fork preserves rejected changes before discarding; discard drops them."
        );
      result = await call("resolve", { session: session(), action: flags.action });
      break;
    case "auth":
      if (!["status", "login"].includes(first())) throw new Error("Use auth status or auth login");
      result = await delta.command(["auth", ...args, ...args[0] === "login" ? ["--no-wait"] : []]);
      break;
    case "org": {
      if (!["list", "current", "create", "switch", "invite"].includes(first()))
        throw new Error("Unknown organization operation");
      const [operation, ...rest] = args;
      result = await delta.command([
        "org",
        operation,
        ...flags.org ? ["--org", flags.org] : [],
        ...rest.length ? ["--", ...rest] : []
      ]);
      break;
    }
    case "search":
      result = await delta.query(["thread", "search", "--", args.join(" ")]);
      break;
    case "show":
    case "tree":
      result = await delta.query(["thread", command, first()]);
      break;
    case "fork":
      result = await delta.command(["thread", command, first()]);
      break;
    case "merge":
      if (!flags.confirm || !flags.into) throw new Error("Merge changes needs --into PARENT --confirm");
      result = await delta.command(["thread", "merge", first(), "--into", flags.into]);
      break;
    case "update":
      result = await delta.command(["update", ...flags.check ? ["--check"] : []]);
      break;
    default:
      throw new Error(`Unknown command ${command}. Run delta-codex --help.`);
  }
  console.log(JSON.stringify(result, null, command === "hook" ? void 0 : 2));
}
main().catch(async (error) => {
  if (process.argv[2] === "hook") {
    const message = `Delta: ${error instanceof Error ? error.message : String(error)}. Run Delta doctor or retry.`;
    let output = { systemMessage: message };
    if (hookEvent?.session_id) {
      const saved = await Recording.load(dataDirectory(), hookEvent.agent_id || hookEvent.session_id).catch(
        () => ({ state: { stopped: false } })
      );
      if (saved && !saved.state.stopped) {
        if (hookEvent.hook_event_name === "UserPromptSubmit") output = { decision: "block", reason: message };
        if (hookEvent.hook_event_name === "PreToolUse")
          output = {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: message
            }
          };
      }
    }
    console.log(JSON.stringify(output));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
});
