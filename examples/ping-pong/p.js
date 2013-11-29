;(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Emitter = require('events').EventEmitter,
	protocol = require('./protocol.js'),
	uuidV4 = require('./utils.js').uuidV4,
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	Connection;

Connection = module.exports = function(p){
	Emitter.call(this);
	this.p = p;
	this.id = uuidV4();
	this.relayedConnections = {};
};
Connection.prototype = Object.create(Emitter.prototype);

Connection.prototype.getApi = function(){
	var api = {};
	api.on = this.on.bind(this);
	api.removeListener = this.removeListener.bind(this);
	api.to = this.to.bind(this);
	api.send = this.send.bind(this);
	api.relayed = this.relayed.bind(this);

	Object.defineProperty(api, 'id', {
		value: this.id
	});

	return api;
};

Connection.prototype.to = function(remoteId){
	var rtcConnection = this.createRtcConnection(this, remoteId),
		api = rtcConnection.getApi();

	api.on('open', this.connectionHandler.bind(this, api));
	rtcConnection.createOffer();
	
	return api;
};

Connection.prototype.send = function(message){
	if(message instanceof ArrayBuffer){
		this.sendToSocket(message);
	} else {
		this.sendProtocolMessage(MESSAGE_TYPE.PLAIN, Array.prototype.slice.call(arguments));
	}
};

Connection.prototype.relay = function(remoteId, message){
	this.sendProtocolMessage(MESSAGE_TYPE.RELAY, remoteId, message);
};

Connection.prototype.relayed = function(remoteId, message){
	this.sendProtocolMessage(MESSAGE_TYPE.RELAYED, remoteId, message);
};

Connection.prototype.sendProtocolMessage = function(messageType){
	var message = Array.prototype.slice.call(arguments);
    message = JSON.stringify(message);
    this.sendToSocket(message);
};

Connection.prototype.messageHandler = function(event){
	if(event.data instanceof ArrayBuffer){
		this.emit("array buffer", event.data);
	} else if(typeof event.data === "string"){
		var message = JSON.parse(event.data);
		switch(message[0]){
			case MESSAGE_TYPE.RELAYED:
				this.relayedMessageHandler(
					message[1], // remoteId
					message[2]  // message
				);
			break;

			case MESSAGE_TYPE.PLAIN:
				this.emitPlainMessage(message[1]);
				break;
			
			case MESSAGE_TYPE.RELAY:
				this.relayMessageHandler(
					message[1], // destinationId
					message[2]  // message
				);
		}
	}
};

Connection.prototype.emitPlainMessage = function(args){
	this.emit.apply(this, ['message'].concat(args));
};

Connection.prototype.relayMessageHandler = function(destinationId, message){
	var destination = this.p.connectionMap[destinationId];
    if(!destination) return;
    
    destination.relayed(
        this.id,
        message
    );
};

Connection.prototype.relayedMessageHandler = function(remoteId, message){
	switch(message[0]){
		case MESSAGE_TYPE.RTC_OFFER:
			this.relayRtcOffer(
				remoteId,
				message[1], // description,
				message[2]  // data
			);
			break;
		case MESSAGE_TYPE.RTC_ANSWER:
			this.relayRtcAnswer(
				remoteId,
				message[1] // description
			);
			break;

		case MESSAGE_TYPE.RTC_ICE_CANDIDATE:
			this.relayRtcIceCandidate(
				remoteId,
				message[1]  // candidate
			);	
			break;
	}
};

Connection.prototype.connectionHandler = function(connection){
	this.emit('connection', connection);
};

Connection.prototype.relayFor = function(connection, remoteId){
	this.relayedConnections[remoteId] = connection;
};

Connection.prototype.cancelRelay = function(connection, remoteId){
	var relayedConnection = this.relayedConnections[remoteId];
	if(relayedConnection === connection){
		delete this.relayedConnections[remoteId];	
	}
};


Connection.prototype.relayRtcOffer = function(remoteId, description, data){
	var self = this;
	
	this.rtcFirewall(data, function(){
		var connection = self.createRtcConnection(self, remoteId),
			api = connection.getApi();
		
		api.on('open', self.connectionHandler.bind(self, api));
		connection.createAnswer(description);
	});
};

Connection.prototype.relayRtcAnswer = function(remoteId, description){
	var connection = this.relayedConnections[remoteId];
	if(!connection) return;

	connection.receiveAnswer(description);
};

Connection.prototype.relayRtcIceCandidate = function(remoteId, candidate){
	var connection = this.relayedConnections[remoteId];
	if(!connection) return;

	connection.addIceCandidate(candidate);
};

Connection.prototype.rtcFirewall = function(data, accept){
	accept();
};

},{"./protocol.js":6,"./utils.js":7,"events":9}],2:[function(require,module,exports){
var Emitter = require('events').EventEmitter,
	protocol = require('./protocol.js'),
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	SocketConnection = require('./SocketConnection.js'),
	P;

P = module.exports = function(emitter){
	this.emitter = emitter;

    this.connectionMap = {};
    this.connectionList = [];
};

P.create = function(options){
	options = options || {};
	var emitter = options.emitter || new Emitter(),
		anarch = new P(emitter);

	return anarch.getApi();
};

P.prototype.getApi = function(){
	var api = {};

	api.on = this.on.bind(this);
	api.removeListener = this.removeListener.bind(this);
	api.to = this.to.bind(this);

	Object.defineProperty(api, 'connections', {
		get: this.getConnections.bind(this)
	});

	return api;
};

P.prototype.getConnections = function(){
	return this.connectionList.slice(0);
};

P.prototype.to = function(address){
	var socketConnection = SocketConnection.create(this, address),
		api = socketConnection.getApi();

	api.on('open', this.connectionHandler.bind(this, api));
	return api;
};

P.prototype.on = function(){
	this.emitter.on.apply(this.emitter, arguments);
	return this;
};

P.prototype.removeListener = function(){
	this.emitter.removeListener.apply(this.emitter, arguments);
	return this;
};

P.prototype.connectionHandler = function(connection){
	connection.on('connection', this.connectionHandler.bind(this));
    connection.on('close', this.connectionCloseHandler.bind(this, connection));
    
    this.connectionMap[connection.id] = connection;
    this.connectionList.push(connection);
    
    this.emitter.emit("connection", connection);
};

P.prototype.connectionCloseHandler = function(connection){
    var index = this.connectionList.indexOf(connection);
    this.connectionList.splice(index, 1);
    delete this.connectionMap[connection.id];
};
},{"./SocketConnection.js":4,"./protocol.js":6,"events":9}],3:[function(require,module,exports){
var protocol = require('./protocol.js'),
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	Connection = require('./Connection.js'),
	RtcConnection;

var DEFAULT_CONFIGURATION = null,
	DEFAULT_CONSTRAINTS = {optional: [{RtpDataChannels: true}]},
	MEDIA_CONSTRAINTS = {
	    optional: [],
	    mandatory: {
	        OfferToReceiveAudio: false,
	        OfferToReceiveVideo: false
	    }
	};

RtcConnection = module.exports = function(connection, rtcConnection){
	this.connection = connection;
	connection.sendToSocket = this.sendToSocket.bind(this);
	connection.createRtcConnection = RtcConnection.create;

	this.rtcConnection = rtcConnection;
	this.rtcConnection.onicecandidate = this.iceCandidateHandler.bind(this);
	this.rtcConnection.oniceconnectionstatechange = this.iceConnectionStateChangeHandler.bind(this);

	this.socket = rtcConnection.createDataChannel(PROTOCOL_NAME, {reliable: false});
	this.socket.onmessage = this.connection.messageHandler.bind(this.connection);
	this.socket.onopen = this.openHandler.bind(this);
	this.socket.onclose = this.closeHandler.bind(this);
	this.socket.onerror = this.errorHandler.bind(this);
};

RtcConnection.create = function(relay, remoteId, options){
	options = options || {};

	var configuration = options.configuration || DEFAULT_CONFIGURATION,
		constraints = options.constraints || DEFAULT_CONSTRAINTS,
		rtcConnection = options.rtcConnection || new webkitRTCPeerConnection(configuration, constraints),
		connection = new Connection(relay.p),
		peerConnection = new RtcConnection(connection, rtcConnection);

	peerConnection.setRelay(relay, remoteId);

	return peerConnection;
};

RtcConnection.prototype.getApi = function(){
	var api = this.connection.getApi();
	api.close = this.close.bind(this);
	return api;
};

RtcConnection.prototype.close = function(){
	this.rtcConnection.close();
};

RtcConnection.prototype.sendToSocket = function(message){
	switch(this.socket.readyState){
		case 'connecting':
			throw new Error('Can\'t send a message while RTCDataChannel connecting');
		case 'open':
			this.socket.send(message);
			break;
		case 'closing':
		case 'closed':
			throw new Error('Can\'t send a message while RTCDataChannel is closing or closed');
	}
};

RtcConnection.prototype.iceConnectionStateChangeHandler = function(event){
	switch(event.currentTarget.iceConnectionState){
		case 'new': // gathering addresses and/or waiting for remote candidates to be supplied.
			break;
		case 'checking': // received remote candidates on at least one component, and is checking candidate pairs but has not yet found a connection. In addition to checking, it may also still be gathering.
			break;
		case 'connected': // found a usable connection for all components but is still checking other candidate pairs to see if there is a better connection. It may also still be gathering.
			break;
		case 'completed': // finished gathering and checking and found a connection for all components. Open issue: it is not clear how the non controlling ICE side knows it is in the state.
			break;
		case 'failed': // finished checking all candidate pairs and failed to find a connection for at least one component. Connections may have been found for some components.
			break;
		case 'disconnected': // liveness checks have failed for one or more components. This is more aggressive than failed, and may trigger intermittently (and resolve itself without action) on a flaky network.
			break;
		case 'closed': // shut down and is no longer responding to STUN requests.
			break;
	}
};

RtcConnection.prototype.errorHandler = function(event){
	this.connection.emit('error', event);
};

RtcConnection.prototype.openHandler = function(event){
	this.connection.emit('open');
};

RtcConnection.prototype.closeHandler = function(event){
	this.connection.emit('close');
};

RtcConnection.prototype.setRelay = function(relay, remoteId){
	if(this.relay) this.relay.relay(this, this.remoteId);
	
	this.relay = relay;
	this.remoteId = remoteId;
	this.relay.relayFor(this, remoteId);
};

RtcConnection.prototype.iceCandidateHandler = function(event){
	var candidate = event.candidate;
	if(candidate){
		this.relay.relay(this.remoteId,
			[
				MESSAGE_TYPE.RTC_ICE_CANDIDATE,
				candidate
			]
		);
	}
};

RtcConnection.prototype.createOffer = function(){
	var self = this;
	
	this.rtcConnection.createOffer(function(description){
		self.rtcConnection.setLocalDescription(description);
		self.relay.relay(self.remoteId,
			[
				MESSAGE_TYPE.RTC_OFFER,
				description
			]
		);
	}, null, MEDIA_CONSTRAINTS);
};

RtcConnection.prototype.createAnswer = function(remoteDescription){
	var self = this;

	this.rtcConnection.setRemoteDescription(new RTCSessionDescription(remoteDescription));
	this.rtcConnection.createAnswer(function(description){
		self.rtcConnection.setLocalDescription(description);
		self.relay.relay(self.remoteId,
			[
				MESSAGE_TYPE.RTC_ANSWER,
				description
			]
		);
	});
};

RtcConnection.prototype.receiveAnswer = function(description){
	this.rtcConnection.setRemoteDescription(new RTCSessionDescription(description));
};

RtcConnection.prototype.addIceCandidate = function(candidate){
	this.rtcConnection.addIceCandidate(new RTCIceCandidate(candidate));
};
},{"./Connection.js":1,"./protocol.js":6}],4:[function(require,module,exports){
var RtcConnection = require('./RtcConnection.js'),
	protocol = require('./protocol.js'),
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	DEFAULT_ADDRESS = "ws://127.0.0.1:20500/",
	Connection = require('./Connection.js'),
	SocketConnection;

SocketConnection = module.exports = function(connection, socket){
	this.connection = connection;
	connection.sendToSocket = this.sendToSocket.bind(this);
	connection.createRtcConnection = RtcConnection.create;
	
	this.socket = socket;
	socket.onopen = this.openHandler.bind(this);
	socket.onclose = this.closeHandler.bind(this);
	socket.onerror = this.errorHandler.bind(this);
	socket.onmessage = this.connection.messageHandler.bind(this.connection);
};

SocketConnection.create = function(p, address){
	var socket = new WebSocket(address, PROTOCOL_NAME),
		connection = new Connection(p),
		socketConnection = new SocketConnection(connection, socket);
	
	socket.binaryType = "arraybuffer";
	
	return socketConnection;
};

SocketConnection.prototype.getApi = function(){
	var api = this.connection.getApi();
	api.close = this.close.bind(this);
	return api;
};

RtcConnection.prototype.close = function(){
	this.socket.close();
};

SocketConnection.prototype.sendToSocket = function(message){
	switch(this.socket.readyState){
		case WebSocket.CONNECTING:
			throw new Error("Can't send a message while WebSocket connecting");

		case WebSocket.OPEN:
			this.socket.send(message);
			break;

		case WebSocket.CLOSING:
		case WebSocket.CLOSED:
			throw new Error("Can't send a message while WebSocket is closing or closed");
	}

	return this;
};

SocketConnection.prototype.close = function(){
	this.socket.close();
};

SocketConnection.prototype.errorHandler = function(event){
	this.connection.emit('error', event);
};

SocketConnection.prototype.closeHandler = function(event){
	this.connection.emit('close');
};

SocketConnection.prototype.openHandler = function(event){
	this.connection.emit('open');
};
},{"./Connection.js":1,"./RtcConnection.js":3,"./protocol.js":6}],5:[function(require,module,exports){
window.P = require('./P.js');

},{"./P.js":2}],6:[function(require,module,exports){
exports.NAME = "p";
exports.MESSAGE_TYPE = {
	PLAIN: 0, // [0, message]

	RTC_OFFER: 3, // [3, description, data]
	RTC_ANSWER: 4, // [4, description]
	RTC_ICE_CANDIDATE: 5, // [5, candidate]

	RELAY: 6, // [6, address, message]
	RELAYED: 7 // [7, address, message]
};

},{}],7:[function(require,module,exports){
//https://gist.github.com/LeverOne/1308368
exports.uuidV4 = function(a,b){for(b=a='';a++<36;b+=a*51&52?(a^15?8^Math.random()*(a^20?16:4):4).toString(16):'-');return b;};
},{}],8:[function(require,module,exports){


//
// The shims in this file are not fully implemented shims for the ES5
// features, but do work for the particular usecases there is in
// the other modules.
//

var toString = Object.prototype.toString;
var hasOwnProperty = Object.prototype.hasOwnProperty;

// Array.isArray is supported in IE9
function isArray(xs) {
  return toString.call(xs) === '[object Array]';
}
exports.isArray = typeof Array.isArray === 'function' ? Array.isArray : isArray;

// Array.prototype.indexOf is supported in IE9
exports.indexOf = function indexOf(xs, x) {
  if (xs.indexOf) return xs.indexOf(x);
  for (var i = 0; i < xs.length; i++) {
    if (x === xs[i]) return i;
  }
  return -1;
};

// Array.prototype.filter is supported in IE9
exports.filter = function filter(xs, fn) {
  if (xs.filter) return xs.filter(fn);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    if (fn(xs[i], i, xs)) res.push(xs[i]);
  }
  return res;
};

// Array.prototype.forEach is supported in IE9
exports.forEach = function forEach(xs, fn, self) {
  if (xs.forEach) return xs.forEach(fn, self);
  for (var i = 0; i < xs.length; i++) {
    fn.call(self, xs[i], i, xs);
  }
};

// Array.prototype.map is supported in IE9
exports.map = function map(xs, fn) {
  if (xs.map) return xs.map(fn);
  var out = new Array(xs.length);
  for (var i = 0; i < xs.length; i++) {
    out[i] = fn(xs[i], i, xs);
  }
  return out;
};

// Array.prototype.reduce is supported in IE9
exports.reduce = function reduce(array, callback, opt_initialValue) {
  if (array.reduce) return array.reduce(callback, opt_initialValue);
  var value, isValueSet = false;

  if (2 < arguments.length) {
    value = opt_initialValue;
    isValueSet = true;
  }
  for (var i = 0, l = array.length; l > i; ++i) {
    if (array.hasOwnProperty(i)) {
      if (isValueSet) {
        value = callback(value, array[i], i, array);
      }
      else {
        value = array[i];
        isValueSet = true;
      }
    }
  }

  return value;
};

// String.prototype.substr - negative index don't work in IE8
if ('ab'.substr(-1) !== 'b') {
  exports.substr = function (str, start, length) {
    // did we get a negative start, calculate how much it is from the beginning of the string
    if (start < 0) start = str.length + start;

    // call the original function
    return str.substr(start, length);
  };
} else {
  exports.substr = function (str, start, length) {
    return str.substr(start, length);
  };
}

// String.prototype.trim is supported in IE9
exports.trim = function (str) {
  if (str.trim) return str.trim();
  return str.replace(/^\s+|\s+$/g, '');
};

// Function.prototype.bind is supported in IE9
exports.bind = function () {
  var args = Array.prototype.slice.call(arguments);
  var fn = args.shift();
  if (fn.bind) return fn.bind.apply(fn, args);
  var self = args.shift();
  return function () {
    fn.apply(self, args.concat([Array.prototype.slice.call(arguments)]));
  };
};

// Object.create is supported in IE9
function create(prototype, properties) {
  var object;
  if (prototype === null) {
    object = { '__proto__' : null };
  }
  else {
    if (typeof prototype !== 'object') {
      throw new TypeError(
        'typeof prototype[' + (typeof prototype) + '] != \'object\''
      );
    }
    var Type = function () {};
    Type.prototype = prototype;
    object = new Type();
    object.__proto__ = prototype;
  }
  if (typeof properties !== 'undefined' && Object.defineProperties) {
    Object.defineProperties(object, properties);
  }
  return object;
}
exports.create = typeof Object.create === 'function' ? Object.create : create;

// Object.keys and Object.getOwnPropertyNames is supported in IE9 however
// they do show a description and number property on Error objects
function notObject(object) {
  return ((typeof object != "object" && typeof object != "function") || object === null);
}

function keysShim(object) {
  if (notObject(object)) {
    throw new TypeError("Object.keys called on a non-object");
  }

  var result = [];
  for (var name in object) {
    if (hasOwnProperty.call(object, name)) {
      result.push(name);
    }
  }
  return result;
}

// getOwnPropertyNames is almost the same as Object.keys one key feature
//  is that it returns hidden properties, since that can't be implemented,
//  this feature gets reduced so it just shows the length property on arrays
function propertyShim(object) {
  if (notObject(object)) {
    throw new TypeError("Object.getOwnPropertyNames called on a non-object");
  }

  var result = keysShim(object);
  if (exports.isArray(object) && exports.indexOf(object, 'length') === -1) {
    result.push('length');
  }
  return result;
}

var keys = typeof Object.keys === 'function' ? Object.keys : keysShim;
var getOwnPropertyNames = typeof Object.getOwnPropertyNames === 'function' ?
  Object.getOwnPropertyNames : propertyShim;

if (new Error().hasOwnProperty('description')) {
  var ERROR_PROPERTY_FILTER = function (obj, array) {
    if (toString.call(obj) === '[object Error]') {
      array = exports.filter(array, function (name) {
        return name !== 'description' && name !== 'number' && name !== 'message';
      });
    }
    return array;
  };

  exports.keys = function (object) {
    return ERROR_PROPERTY_FILTER(object, keys(object));
  };
  exports.getOwnPropertyNames = function (object) {
    return ERROR_PROPERTY_FILTER(object, getOwnPropertyNames(object));
  };
} else {
  exports.keys = keys;
  exports.getOwnPropertyNames = getOwnPropertyNames;
}

// Object.getOwnPropertyDescriptor - supported in IE8 but only on dom elements
function valueObject(value, key) {
  return { value: value[key] };
}

if (typeof Object.getOwnPropertyDescriptor === 'function') {
  try {
    Object.getOwnPropertyDescriptor({'a': 1}, 'a');
    exports.getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  } catch (e) {
    // IE8 dom element issue - use a try catch and default to valueObject
    exports.getOwnPropertyDescriptor = function (value, key) {
      try {
        return Object.getOwnPropertyDescriptor(value, key);
      } catch (e) {
        return valueObject(value, key);
      }
    };
  }
} else {
  exports.getOwnPropertyDescriptor = valueObject;
}

},{}],9:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util');

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!util.isNumber(n) || n < 0)
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (util.isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (util.isUndefined(handler))
    return false;

  if (util.isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (util.isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              util.isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (util.isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (util.isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!util.isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  function g() {
    this.removeListener(type, g);
    listener.apply(this, arguments);
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!util.isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (util.isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (util.isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (util.isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (util.isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (util.isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};
},{"util":10}],10:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var shims = require('_shims');

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  shims.forEach(array, function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = shims.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = shims.getOwnPropertyNames(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }

  shims.forEach(keys, function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = shims.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }

  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (shims.indexOf(ctx.seen, desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = shims.reduce(output, function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return shims.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) && objectToString(e) === '[object Error]';
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.binarySlice === 'function'
  ;
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = shims.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = shims.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

},{"_shims":8}]},{},[5])
;