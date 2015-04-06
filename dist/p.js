(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.P = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = require('./lib/P.js');
},{"./lib/P.js":5}],2:[function(require,module,exports){
var JSONProtocol = require('./JSONProtocol.js'),
	its = require('its'),
	Emitter = require('events').EventEmitter;

function notImplemented(){
	throw new Error('This method is not implemented');
}

function Connection(address, peers, options){
	its.string(address);
	its.defined(peers);

	this.address = address;
	this.peers = peers;

	if(options){
		if(options.emitter) this.emitter = options.emitter;
		if(options.firewall) this.acceptRTCConnection = options.firewall;
	}

	if(!this.emitter) this.emitter = new Connection.Emitter();
}

// Circular dependency solved in WebRTCConnection.js
Connection.createWebRTCConnection = null;

Connection.Emitter = Emitter;

Connection.prototype = Object.create(JSONProtocol.prototype);

Connection.prototype.on = function(){
	this.emitter.on.apply(this.emitter, arguments);
	return this;
};

Connection.prototype.removeListener = function(){
	this.emitter.removeListener.apply(this.emitter, arguments);
	return this;
};

Connection.prototype.send = JSONProtocol.prototype.writeMessage;

Connection.prototype.getPeer = function(address){
	return this.peers.get(address);
};

Connection.prototype.addPeer = function(peer){
	return this.peers.add(peer);
};

Connection.prototype.getPeers = function() {
	return this.peers.get();
};

function isString(candidate){
	return Object.prototype.toString.call(candidate) === '[object String]';
}

Connection.prototype.connect = function(config){
	if(isString(config)){
		config = {address: config};
	}

	var self = this,
		firewall = config.firewall || this.firewall,
		peer = Connection.createWebRTCConnection(config, this.peers, this, {firewall: firewall});

	peer.writeOffer(config);

	this.peers.add(peer);

	peer.on('close', function(){
		self.peers.remove(peer);
		self.emitter.emit('disconnection', peer);
	});

	this.emitter.emit('connection', peer);

	return peer;
};

Connection.prototype.readMessage = function(message){
	this.emitter.emit('message', message);
};

Connection.prototype.readArrayBuffer = function(message){
	this.emitter.emit('arraybuffer', message);
};

Connection.prototype.acceptRTCConnection = function(/*description, data*/){
	return true;
};

Connection.prototype.readRelay = function(peerAddress, message){
	var peer = this.getPeer(peerAddress);

	if(!peer){
		this.emitter.emit('error', new Error('Unknown peer at address: ' + peerAddress));
		return;
	}

	peer.writeRelayedMessage(this.address, message);
};

Connection.prototype.readRelayedIceCandidate = function(peerAddress, candidate){
	var peer = this.getPeer(peerAddress);

	if(!peer){
		this.emitter.emit('error', new Error('Unknown peer at address: ' + peerAddress));
		return;
	}

	peer.readIceCandidate(candidate);
};

Connection.prototype.readRelayedOffer = function(peerAddress, description, data){
	if(!this.acceptRTCConnection(description, data)) return false;

	var self = this,
		peer = Connection.createWebRTCConnection({address:peerAddress}, this.peers, this, {firewall: this.firewall});

	this.addPeer(peer);

	peer.on('close', function(){
		self.peers.remove(peer);
		self.emitter.emit('disconnection', peer);
	});

	peer.readOffer(description);
	peer.writeAnswer();

	this.emitter.emit('connection', peer);
};

Connection.prototype.readRelayedAnswer = function(peerAddress, description){
	var peer = this.getPeer(peerAddress);

	if(!peer){
		this.emitter.emit('error', new Error('Unknown peer at address: ' + peerAddress));
		return;
	}

	peer.readAnswer(description);
};

Connection.prototype.close = notImplemented; // implemented higher up
Connection.prototype.getReadyState = notImplemented; // implemented higher up

Connection.prototype.isOpen = function(){
	return this.getReadyState() === 'open';
};

module.exports = Connection;

},{"./JSONProtocol.js":4,"events":8,"its":9}],3:[function(require,module,exports){
var its = require('its');

function noop(){}

function ConnectionManager(){
	this.connectionMap = {};
	this.connectionList = [];
}

ConnectionManager.prototype.get = function(address){
	if(address === undefined) return this.connectionList.slice();

	return this.connectionMap[address];
};

ConnectionManager.prototype.add = function(connection) {
	its.defined(connection);

	var address = connection.address;
	its.string(address);

	if(address in this.connectionMap) return false;
	
	this.connectionMap[address] = connection;
	this.connectionList.push(connection);

	this.onAdd(connection);
	return true;
};
ConnectionManager.prototype.onAdd = noop;

ConnectionManager.prototype.remove = function(connection){
	its.defined(connection);

	var address = connection.address;
	its.string(address);

	var mappedConnection = this.connectionMap[address];
	if(!mappedConnection || mappedConnection !== connection) return false;

	delete this.connectionMap[address];
	
	var index = this.connectionList.indexOf(connection);
	this.connectionList.splice(index, 1);

	this.onRemove(connection);
	return true;
};
ConnectionManager.prototype.onRemove = noop;

module.exports = ConnectionManager;
},{"its":9}],4:[function(require,module,exports){
function notImplemented(){
	throw new Error('This method is not implemented');
}

function JSONProtocol(){}

JSONProtocol.prototype.PROTOCOL_NAME = 'p';

JSONProtocol.prototype.MESSAGE_TYPE = {
	DIRECT: 0, // [0, message]

	RTC_OFFER: 3, // [3, description, data]
	RTC_ANSWER: 4, // [4, description]
	RTC_ICE_CANDIDATE: 5, // [5, candidate]

	RELAY: 6, // [6, address, message]
	RELAYED: 7 // [7, address, message]
};

JSONProtocol.prototype.readRaw = function(message){
	if(message instanceof ArrayBuffer){
		this.readArrayBuffer(message);
	} else {
		this.readProtocolMessage(JSON.parse(message));
	}	
};

JSONProtocol.prototype.readProtocolMessage = function(message){
	var MESSAGE_TYPE = this.MESSAGE_TYPE,
		messageType = message[0];
	
	switch(messageType){
		// This is a message from the remote node to this one.
		case MESSAGE_TYPE.DIRECT:
			this.readMessage(message[1]);
			break;

		// The message was relayed by the peer on behalf of
		// a third party peer, identified by "thirdPartyPeerId".
		// This means that the peer is acting as a signalling
		// channel on behalf of the third party peer.
		case MESSAGE_TYPE.RELAYED:
			this.readRelayedMessage(message[1], message[2]);
			break;

		// The message is intended for another peer, identified
		// by "peerId", which is also connected to this node.
		// This means that the peer is using this connection
		// as a signalling channel in order to establish a connection
		// to the other peer identified "peerId".
		case MESSAGE_TYPE.RELAY:
			this.readRelay(message[1], message[2]);
			break;

		default:
			throw new Error('Unknown message type: ' + messageType);
	}
};

JSONProtocol.prototype.readRelayedMessage = function(origin, message){
	var MESSAGE_TYPE = this.MESSAGE_TYPE,
		messageType = message[0];

	switch(messageType){
		// An initial connection request from a third party peer
		case MESSAGE_TYPE.RTC_OFFER:
			this.readRelayedOffer(origin, message[1], message[2]);
			break;
		
		// An answer to an RTC offer sent from this node
		case MESSAGE_TYPE.RTC_ANSWER:
			this.readRelayedAnswer(origin, message[1]);
			break;
		
		// An ICE candidate from the source node
		case MESSAGE_TYPE.RTC_ICE_CANDIDATE:
			this.readRelayedIceCandidate(origin, message[1]);
			break;

		default:
			throw new Error('Unknown message type: ' + messageType);
	}		
};

JSONProtocol.prototype.readMessage = notImplemented;
JSONProtocol.prototype.readArrayBuffer = notImplemented;
JSONProtocol.prototype.readRelay = notImplemented;

JSONProtocol.prototype.readRelayedOffer = notImplemented;
JSONProtocol.prototype.readRelayedAnswer = notImplemented;
JSONProtocol.prototype.readRelayedIceCandidate = notImplemented;

JSONProtocol.prototype.writeRaw = notImplemented;

JSONProtocol.prototype.writeProtocolMessage = function(message){
	var serializedMessage = JSON.stringify(message);
	this.writeRaw(serializedMessage);
};

JSONProtocol.prototype.writeMessage = function(message){
	if(message instanceof ArrayBuffer){
		this.writeRaw(message);
	} else {
		this.writeStringMessage(message);
	}
};

JSONProtocol.prototype.writeStringMessage = function(message){
	this.writeProtocolMessage([
		this.MESSAGE_TYPE.DIRECT,
		message
	]);
};

JSONProtocol.prototype.writeRelayedMessage = function(origin, message){
	this.writeProtocolMessage([
		this.MESSAGE_TYPE.RELAYED,
		origin,
		message
	]);
};

JSONProtocol.prototype.writeRelayMessage = function(destination, message){
	this.writeProtocolMessage([
		this.MESSAGE_TYPE.RELAY,
		destination,
		message
	]);
};

JSONProtocol.prototype.writeRelayAnswer = function(destination, description){
	this.writeRelayMessage(destination, [
		this.MESSAGE_TYPE.RTC_ANSWER,
		description
	]);
};

JSONProtocol.prototype.writeRelayIceCandidate = function(destination, candidate){
	this.writeRelayMessage(destination, [
		this.MESSAGE_TYPE.RTC_ICE_CANDIDATE,
		candidate
	]);
};

JSONProtocol.prototype.writeRelayOffer = function(destination, description, data){
	this.writeRelayMessage(destination, [
		this.MESSAGE_TYPE.RTC_OFFER,
		description,
		data
	]);
};

module.exports = JSONProtocol;
},{}],5:[function(require,module,exports){
var Emitter = require('events').EventEmitter,
	ConnectionManager = require('./ConnectionManager.js'),
	WebSocketConnection = require('./WebSocketConnection.js'),
	its = require('its');

require('./WebRtcConnection');

function P(emitter, connectionManager, options){
	its.defined(emitter);
	its.defined(connectionManager);

	this.emitter = emitter;
	this.peers = connectionManager;

	this.peers.onAdd = function(peer){
		emitter.emit('connection', peer);
	};

	this.peers.onRemove = function(peer){
		emitter.emit('disconnection', peer);
	};

	if(options && options.firewall) this.firewall = options.firewall;
}

P.create = function(options){
	var emitter = new Emitter(),
		connectionManager = new ConnectionManager();

	return new P(emitter, connectionManager, options);
};

P.prototype.getPeers = function(){
	return this.peers.get();
};

P.prototype.connect = function(address){
	its.string(address);

	var peers = this.peers,
		peer = WebSocketConnection.create(address, this.peers, {firewall: this.firewall});

	peers.add(peer);

	peer.on('close', function(){
		peers.remove(peer);
	});

	return peer;
};

P.prototype.on = function(){
	this.emitter.on.apply(this.emitter, arguments);
	return this;
};

P.prototype.removeListener = function(){
	this.emitter.removeListener.apply(this.emitter, arguments);
	return this;
};

module.exports = P;

},{"./ConnectionManager.js":3,"./WebRtcConnection":6,"./WebSocketConnection.js":7,"events":8,"its":9}],6:[function(require,module,exports){
/*global
		RTCPeerConnection,
		webkitRTCPeerConnection,
		mozRTCPeerConnection,
		RTCSessionDescription,
		mozRTCSessionDescription,
		RTCIceCandidate,
		mozRTCIceCandidate
*/

var Connection = require('./Connection.js'),
	its = require('its');

var nativeRTCPeerConnection = (typeof RTCPeerConnection !== 'undefined')? RTCPeerConnection :
							  (typeof webkitRTCPeerConnection !== 'undefined')? webkitRTCPeerConnection :
							  (typeof mozRTCPeerConnection !== 'undefined')? mozRTCPeerConnection :
							  undefined;

var nativeRTCSessionDescription = (typeof RTCSessionDescription !== 'undefined')? RTCSessionDescription :
								  (typeof mozRTCSessionDescription !== 'undefined')? mozRTCSessionDescription :
								  undefined;
var nativeRTCIceCandidate = (typeof RTCIceCandidate !== 'undefined')? RTCIceCandidate :
							(typeof mozRTCIceCandidate !== 'undefined')? mozRTCIceCandidate :
							undefined;

var log = function(){};

if(typeof window !== 'undefined' && window.P_DEBUGGING_ENABLED){
	log = function(label, event, obj){
		window.console.debug(label, event, obj);
	};
}

function WebRTCConnection(address, peers, rtcConnection, signalingChannel, options){
	var self = this;

	its.string(address);
	its.defined(peers);
	its.defined(rtcConnection);
	its.defined(signalingChannel);

	Connection.call(this, address, peers, options);

	this.signalingChannel = signalingChannel;
	this.rtcConnection = rtcConnection;
	this.rtcDataChannel = rtcConnection.createDataChannel(this.PROTOCOL_NAME, {protocol: this.PROTOCOL_NAME});


	// Bug in FF seems to garbage collect the stale ref causing it to close
	// the prevents it from being lost in a GC event
	this._initialRtcDataChannel = this.rtcDataChannel;


	this.close = rtcConnection.close.bind(rtcConnection);

	this.rtcConnection.addEventListener('icecandidate', function(event){
		if(!event.candidate) return;
		log('ice candidate', event, self);
		self.signalingChannel.writeRelayIceCandidate(address, event.candidate);
	});

	this.rtcConnection.addEventListener('datachannel', function(event){
		log('datachannel', event, self);

		var rtcDataChannel = self.rtcDataChannel = event.channel;
		rtcDataChannel.addEventListener('open', function(event){
			log('remote datachannel open', event, self);
			self.emitter.emit('open', event);
		});

		rtcDataChannel.addEventListener('close', function(event){
			log('remote datachannel close', event, self);
			self.emitter.emit('close', event);
		});

		rtcDataChannel.addEventListener('error', function(event){
			log('remote datachannel error', event, self);
			self.emitter.emit('error', event);
		});
	});

	this.rtcDataChannel.addEventListener('message', function(message){
		log('local datachannel message', message, self);
		self.readRaw(message.data);
	});

	this.rtcDataChannel.addEventListener('error', function(event){
		log('local datachannel error', event, self);
		self.emitter.emit('error', event);
	});

	this.rtcDataChannel.addEventListener('close', function(event){
		log('local datachannel close', event, self);
		self.emitter.emit('close', event);
	});
}

var DEFAULT_RTC_CONFIGURATION = null;
var DEFAULT_RTC_OFFER_OPTIONS = {
	offerToReceiveAudio: false,
	offerToReceiveVideo: false,
	iceRestart: false
};

//DEFAULT_RTC_OFFER_OPTIONS
WebRTCConnection.create = function(config, peers, signalingChannel, options){
	var rtcConfiguration = config.rtcConfiguration || DEFAULT_RTC_CONFIGURATION,
		rtcConnection = new nativeRTCPeerConnection(rtcConfiguration);

	return new WebRTCConnection(config.address, peers, rtcConnection, signalingChannel, options);
};

WebRTCConnection.prototype = Object.create(Connection.prototype);

WebRTCConnection.prototype.writeRaw = function(message){
	switch(this.rtcDataChannel.readyState){
		case 'connecting':
			throw new Error('Can\'t send a message while RTCDataChannel connecting');
		case 'open':
			this.rtcDataChannel.send(message);
			log('sent message to remote', message, this);
			break;
		case 'closing':
		case 'closed':
			throw new Error('Can\'t send a message while RTCDataChannel is closing or closed');
	}
};

WebRTCConnection.prototype.readAnswer = function(description){
	var rtcSessionDescription = new nativeRTCSessionDescription(description);

	this.rtcConnection.setRemoteDescription(rtcSessionDescription);
};

WebRTCConnection.prototype.readOffer = function(description){
	var rtcSessionDescription = new nativeRTCSessionDescription(description);
	this.rtcConnection.setRemoteDescription(rtcSessionDescription);
};

WebRTCConnection.prototype.readIceCandidate = function(candidate){
	this.rtcConnection.addIceCandidate(new nativeRTCIceCandidate(candidate));
};

WebRTCConnection.prototype.writeAnswer = function(){
	var emitter = this.emitter,
		address = this.address,
		rtcConnection = this.rtcConnection,
		signalingChannel = this.signalingChannel;

	function onError(err){ emitter.emit('error', err); }

	rtcConnection.createAnswer(function(description){
		rtcConnection.setLocalDescription(description, function(){
			signalingChannel.writeRelayAnswer(address, description);
		}, onError);
	}, onError);
};

WebRTCConnection.prototype.writeOffer = function(config){
	var emitter = this.emitter,
		address = this.address,
		rtcConnection = this.rtcConnection,
		signalingChannel = this.signalingChannel;

	function onError(err){ emitter.emit('error', err); }

	rtcConnection.createOffer(function(description){
		rtcConnection.setLocalDescription(description, function(){
			signalingChannel.writeRelayOffer(address, description, config.offerData);
		}, onError);
	}, onError, config.rtcOfferOptions || DEFAULT_RTC_OFFER_OPTIONS);
};

WebRTCConnection.prototype.getReadyState = function(){
	return this.rtcDataChannel.readyState;
};

// Solves the circular dependency with Connection.js
Connection.createWebRTCConnection = WebRTCConnection.create;

module.exports = WebRTCConnection;

},{"./Connection.js":2,"its":9}],7:[function(require,module,exports){
var Connection = require('./Connection.js');

var WebSocketState = {
	CONNECTING: 0,
	OPEN: 1,
	CLOSING: 2,
	CLOSED: 3
};

if(typeof WebSocket !== 'undefined'){
	WebSocketState = WebSocket;
}

function WebSocketConnection(address, peers, webSocket, options){
	var self = this;

	Connection.call(this, address, peers, options);

	this.webSocket = webSocket;

	this.close = webSocket.close.bind(webSocket);

	this.webSocket.addEventListener('message', function(message){
		self.readRaw(message.data);
	});

	this.webSocket.addEventListener('open', function(event){
		self.emitter.emit('open', event);
	});

	this.webSocket.addEventListener('error', function(event){
		self.emitter.emit('error', event);
	});

	this.webSocket.addEventListener('close', function(event){
		self.emitter.emit('close', event);
	});
}

WebSocketConnection.create = function(address, peers, options){
	var webSocket = new WebSocket(address, WebSocketConnection.prototype.PROTOCOL_NAME);
	return new WebSocketConnection(address, peers, webSocket, options);
};

WebSocketConnection.prototype = Object.create(Connection.prototype);
WebSocketConnection.prototype.writeRaw = function(message){
	switch(this.webSocket.readyState){
		case WebSocketState.CONNECTING:
			throw new Error('Can\'t send a message while WebSocket connecting');

		case WebSocketState.OPEN:
			this.webSocket.send(message);
			break;

		case WebSocketState.CLOSING:
		case WebSocketState.CLOSED:
			throw new Error('Can\'t send a message while WebSocket is closing or closed');
	}
};

WebSocketConnection.prototype.getReadyState = function(){
	switch(this.webSocket.readyState){
		case WebSocketState.CONNECTING:
			return 'connecting';
		case WebSocketState.OPEN:
			return 'open';
		case WebSocketState.CLOSING:
			return 'closing';
		case WebSocketState.CLOSED:
			return 'closed';
	}
};

module.exports = WebSocketConnection;

},{"./Connection.js":2}],8:[function(require,module,exports){
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
  if (!isNumber(n) || n < 0 || isNaN(n))
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
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
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
  } else if (isObject(handler)) {
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

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
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
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
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

  if (isFunction(listeners)) {
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
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],9:[function(require,module,exports){
module.exports = require('./lib/its.js');
},{"./lib/its.js":10}],10:[function(require,module,exports){
// Helpers
var slice = Array.prototype.slice;
var toString = Object.prototype.toString;

var templateRegEx = /%s/; // The template placeholder, used to split message templates

/** A basic templating function. 
	
	Takes a string with 0 or more '%s' placeholders and an array to populate it with.

	@param {String} messageTemplate A string which may or may not have 0 or more '%s' to denote argument placement
	@param {Array} [messageArguments] Items to populate the template with

	@example
		templatedMessage("Hello"); // returns "Hello"
		templatedMessage("Hello, %s", ["world"]); // returns "Hello, world"
		templatedMessage("Hello, %s. It's %s degrees outside.", ["world", 72]); // returns "Hello, world. It's 72 degrees outside"

	@returns {String} The resolved message
*/
var templatedMessage = function(messageTemplate, messageArguments){
	var result = [],
		messageArray = messageTemplate.split(templateRegEx),
		index = 0,
		length = messageArray.length;

	for(; index < length; index++){
		result.push(messageArray[index]);
		result.push(messageArguments[index]);
	}

	return result.join('');
};


/** Generic check function which throws an error if a given expression is false
*
*	The params list is a bit confusing, check the examples to see the available ways of calling this function
*
*	@param {Boolean} expression The determinant of whether an exception is thrown
*	@param {String|Object} [messageOrErrorType] A message or an ErrorType object to throw if expression is false
*   @param {String|Object} [messageOrMessageArgs] A message, message template, or a message argument
*	@param {...Object} [messageArgs] Arguments for a provided message template
*
*	@returns {Boolean} Returns the expression passed  
*	@throws {Error}
*
*	@example
*		its(0 < 10); // returns true
*		its(0 > 10); // throws Error with no message
*		its(0 > 10, "Something went wrong!"); // throws Error with message: "Something went wrong!"
*		its(0 > 10, "%s went %s!", "something", "wrong"); // throws Error with message: "Something went wrong!"
*		its(0 > 10, RangeError, "%s went %s!", "something", "wrong"); // throws RangeError with message: "Something went wrong!"
*		its(0 > 10, RangeError); // throws RangeError with no message
*/
var its = module.exports = function(expression, messageOrErrorType){
	if(expression === false){
		if(messageOrErrorType && typeof messageOrErrorType !== "string"){ // Check if custom error object passed
			throw messageOrErrorType(arguments.length > 3 ? templatedMessage(arguments[2], slice.call(arguments,3)) : arguments[2]);	
		} else {
			throw new Error(arguments.length > 2 ? templatedMessage(messageOrErrorType, slice.call(arguments,2)) : messageOrErrorType);	
		}
	}
	return expression;
};

/** Throws a TypeError if a given expression is false
*
*	@param {Boolean} expression The determinant of whether an exception is thrown
*	@param {String} [message] A message or message template for the error (if it gets thrown)
*	@param {...Object} [messageArgs] Arguments for a provided message template
*
*	@returns {Boolean} Returns the expression passed  
*	@throws {TypeError}
*
*	@example
*		its.type(typeof "Team" === "string"); // returns true
*		its.type(typeof "Team" === "number"); // throws TypeError with no message
*		its.type(void 0, "Something went wrong!"); // throws TypeError with message: "Something went wrong!"
*		its.type(void 0, "%s went %s!", "something", "wrong"); // throws TypeError with message: "Something went wrong!"
*/
its.type = function(expression, message){
	if(expression === false){
		throw new TypeError(arguments.length > 2 ? templatedMessage(message, slice.call(arguments,2)) : message);
	}
	return expression;
};

// Helpers
its.undefined = function(expression){
	return its.type.apply(null, [expression === void 0].concat(slice.call(arguments, 1)));
};

its.null = function(expression){
	return its.type.apply(null, [expression === null].concat(slice.call(arguments, 1)));
};

its.boolean = function(expression){
	return its.type.apply(null, [expression === true || expression === false || toString.call(expression) === "[object Boolean]"].concat(slice.call(arguments, 1)));
};

its.array = function(expression){
	return its.type.apply(null, [toString.call(expression) === "[object Array]"].concat(slice.call(arguments, 1)));
};

its.object = function(expression){
	return its.type.apply(null, [expression === Object(expression)].concat(slice.call(arguments, 1)));
};

/** This block creates 
*	its.function
*	its.string
*	its.number
*	its.date
*	its.regexp
*/
(function(){
	var types = [
			['args','Arguments'],
			['func', 'Function'], 
			['string', 'String'], 
			['number', 'Number'], 
			['date', 'Date'], 
			['regexp', 'RegExp']
		],
		index = 0,
		length = types.length;

	for(; index < length; index++){
		(function(){
			var theType = types[index];
			its[theType[0]] = function(expression){
				return its.type.apply(null, [toString.call(expression) === '[object ' + theType[1] + ']'].concat(slice.call(arguments, 1)));
			};
		}());
	}
}());

// optimization from underscore.js by documentcloud -- underscorejs.org
if (typeof (/./) !== 'function') {
	its.func = function(expression) {
		return its.type.apply(null, [typeof expression === "function"].concat(slice.call(arguments, 1)));
	};
}

/** Throws a ReferenceError if a given expression is false
*
*	@param {Boolean} expression The determinant of whether an exception is thrown
*	@param {String} [message] A message or message template for the error (if it gets thrown)
*	@param {...Object} [messageArgs] Arguments for a provided message template
*
*	@returns {Object} Returns the expression passed  
*	@throws {ReferenceError}
*
*	@example
*		its.defined("Something"); // returns true
*		its.defined(void 0); // throws ReferenceError with no message
*		its.defined(void 0, "Something went wrong!"); // throws ReferenceError with message: "Something went wrong!"
*		its.defined(void 0, "%s went %s!", "something", "wrong"); // throws ReferenceError with message: "Something went wrong!"
*/
its.defined = function(expression, message){
	if(expression === void 0){
		throw new ReferenceError(arguments.length > 2 ? templatedMessage(message, slice.call(arguments,2)) : message);
	}

	return expression;
};

/** Throws a RangeError if a given expression is false
*
*	@param {Boolean} expression The determinant of whether an exception is thrown
*	@param {String} [message] A message or message template for the error (if it gets thrown)
*	@param {...Object} [messageArgs] Arguments for a provided message template
*
*	@returns {Boolean} Returns the expression passed  
*	@throws {RangeError}
*
*	@example
*		its.range(1 > 0); // returns true
*		its.range(1 < 2); // throws RangeError with no message
*		its.range(1 < 2 && 1 > 2, "Something went wrong!"); // throws RangeError with message: "Something went wrong!"
*		its.range(1 < 2 && 1 > 2, "%s went %s!", "something", "wrong"); // throws RangeError with message: "Something went wrong!"
*/
its.range = function(expression, message){
	if(expression === false){
		throw new RangeError(arguments.length > 2 ? templatedMessage(message, slice.call(arguments,2)) : message);
	}

	return expression;
};
},{}]},{},[1])(1)
});


//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9ib2lsZXJwbGF0ZS1ndWxwLWpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJpbmRleC5qcyIsImxpYi9Db25uZWN0aW9uLmpzIiwibGliL0Nvbm5lY3Rpb25NYW5hZ2VyLmpzIiwibGliL0pTT05Qcm90b2NvbC5qcyIsImxpYi9QLmpzIiwibGliL1dlYlJ0Y0Nvbm5lY3Rpb24uanMiLCJsaWIvV2ViU29ja2V0Q29ubmVjdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9ib2lsZXJwbGF0ZS1ndWxwLWpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL2l0cy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pdHMvbGliL2l0cy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6IlAuanMiLCJzb3VyY2VSb290IjoiL3NvdXJjZS8iLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvUC5qcycpOyIsInZhciBKU09OUHJvdG9jb2wgPSByZXF1aXJlKCcuL0pTT05Qcm90b2NvbC5qcycpLFxuXHRpdHMgPSByZXF1aXJlKCdpdHMnKSxcblx0RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuZnVuY3Rpb24gbm90SW1wbGVtZW50ZWQoKXtcblx0dGhyb3cgbmV3IEVycm9yKCdUaGlzIG1ldGhvZCBpcyBub3QgaW1wbGVtZW50ZWQnKTtcbn1cblxuZnVuY3Rpb24gQ29ubmVjdGlvbihhZGRyZXNzLCBwZWVycywgb3B0aW9ucyl7XG5cdGl0cy5zdHJpbmcoYWRkcmVzcyk7XG5cdGl0cy5kZWZpbmVkKHBlZXJzKTtcblxuXHR0aGlzLmFkZHJlc3MgPSBhZGRyZXNzO1xuXHR0aGlzLnBlZXJzID0gcGVlcnM7XG5cblx0aWYob3B0aW9ucyl7XG5cdFx0aWYob3B0aW9ucy5lbWl0dGVyKSB0aGlzLmVtaXR0ZXIgPSBvcHRpb25zLmVtaXR0ZXI7XG5cdFx0aWYob3B0aW9ucy5maXJld2FsbCkgdGhpcy5hY2NlcHRSVENDb25uZWN0aW9uID0gb3B0aW9ucy5maXJld2FsbDtcblx0fVxuXG5cdGlmKCF0aGlzLmVtaXR0ZXIpIHRoaXMuZW1pdHRlciA9IG5ldyBDb25uZWN0aW9uLkVtaXR0ZXIoKTtcbn1cblxuLy8gQ2lyY3VsYXIgZGVwZW5kZW5jeSBzb2x2ZWQgaW4gV2ViUlRDQ29ubmVjdGlvbi5qc1xuQ29ubmVjdGlvbi5jcmVhdGVXZWJSVENDb25uZWN0aW9uID0gbnVsbDtcblxuQ29ubmVjdGlvbi5FbWl0dGVyID0gRW1pdHRlcjtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEpTT05Qcm90b2NvbC5wcm90b3R5cGUpO1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uKCl7XG5cdHRoaXMuZW1pdHRlci5vbi5hcHBseSh0aGlzLmVtaXR0ZXIsIGFyZ3VtZW50cyk7XG5cdHJldHVybiB0aGlzO1xufTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbigpe1xuXHR0aGlzLmVtaXR0ZXIucmVtb3ZlTGlzdGVuZXIuYXBwbHkodGhpcy5lbWl0dGVyLCBhcmd1bWVudHMpO1xuXHRyZXR1cm4gdGhpcztcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnNlbmQgPSBKU09OUHJvdG9jb2wucHJvdG90eXBlLndyaXRlTWVzc2FnZTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuZ2V0UGVlciA9IGZ1bmN0aW9uKGFkZHJlc3Mpe1xuXHRyZXR1cm4gdGhpcy5wZWVycy5nZXQoYWRkcmVzcyk7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5hZGRQZWVyID0gZnVuY3Rpb24ocGVlcil7XG5cdHJldHVybiB0aGlzLnBlZXJzLmFkZChwZWVyKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmdldFBlZXJzID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLnBlZXJzLmdldCgpO1xufTtcblxuZnVuY3Rpb24gaXNTdHJpbmcoY2FuZGlkYXRlKXtcblx0cmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChjYW5kaWRhdGUpID09PSAnW29iamVjdCBTdHJpbmddJztcbn1cblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKGNvbmZpZyl7XG5cdGlmKGlzU3RyaW5nKGNvbmZpZykpe1xuXHRcdGNvbmZpZyA9IHthZGRyZXNzOiBjb25maWd9O1xuXHR9XG5cblx0dmFyIHNlbGYgPSB0aGlzLFxuXHRcdGZpcmV3YWxsID0gY29uZmlnLmZpcmV3YWxsIHx8IHRoaXMuZmlyZXdhbGwsXG5cdFx0cGVlciA9IENvbm5lY3Rpb24uY3JlYXRlV2ViUlRDQ29ubmVjdGlvbihjb25maWcsIHRoaXMucGVlcnMsIHRoaXMsIHtmaXJld2FsbDogZmlyZXdhbGx9KTtcblxuXHRwZWVyLndyaXRlT2ZmZXIoY29uZmlnKTtcblxuXHR0aGlzLnBlZXJzLmFkZChwZWVyKTtcblxuXHRwZWVyLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XG5cdFx0c2VsZi5wZWVycy5yZW1vdmUocGVlcik7XG5cdFx0c2VsZi5lbWl0dGVyLmVtaXQoJ2Rpc2Nvbm5lY3Rpb24nLCBwZWVyKTtcblx0fSk7XG5cblx0dGhpcy5lbWl0dGVyLmVtaXQoJ2Nvbm5lY3Rpb24nLCBwZWVyKTtcblxuXHRyZXR1cm4gcGVlcjtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLnJlYWRNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSl7XG5cdHRoaXMuZW1pdHRlci5lbWl0KCdtZXNzYWdlJywgbWVzc2FnZSk7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5yZWFkQXJyYXlCdWZmZXIgPSBmdW5jdGlvbihtZXNzYWdlKXtcblx0dGhpcy5lbWl0dGVyLmVtaXQoJ2FycmF5YnVmZmVyJywgbWVzc2FnZSk7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5hY2NlcHRSVENDb25uZWN0aW9uID0gZnVuY3Rpb24oLypkZXNjcmlwdGlvbiwgZGF0YSovKXtcblx0cmV0dXJuIHRydWU7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5yZWFkUmVsYXkgPSBmdW5jdGlvbihwZWVyQWRkcmVzcywgbWVzc2FnZSl7XG5cdHZhciBwZWVyID0gdGhpcy5nZXRQZWVyKHBlZXJBZGRyZXNzKTtcblxuXHRpZighcGVlcil7XG5cdFx0dGhpcy5lbWl0dGVyLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdVbmtub3duIHBlZXIgYXQgYWRkcmVzczogJyArIHBlZXJBZGRyZXNzKSk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cGVlci53cml0ZVJlbGF5ZWRNZXNzYWdlKHRoaXMuYWRkcmVzcywgbWVzc2FnZSk7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5yZWFkUmVsYXllZEljZUNhbmRpZGF0ZSA9IGZ1bmN0aW9uKHBlZXJBZGRyZXNzLCBjYW5kaWRhdGUpe1xuXHR2YXIgcGVlciA9IHRoaXMuZ2V0UGVlcihwZWVyQWRkcmVzcyk7XG5cblx0aWYoIXBlZXIpe1xuXHRcdHRoaXMuZW1pdHRlci5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignVW5rbm93biBwZWVyIGF0IGFkZHJlc3M6ICcgKyBwZWVyQWRkcmVzcykpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdHBlZXIucmVhZEljZUNhbmRpZGF0ZShjYW5kaWRhdGUpO1xufTtcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUucmVhZFJlbGF5ZWRPZmZlciA9IGZ1bmN0aW9uKHBlZXJBZGRyZXNzLCBkZXNjcmlwdGlvbiwgZGF0YSl7XG5cdGlmKCF0aGlzLmFjY2VwdFJUQ0Nvbm5lY3Rpb24oZGVzY3JpcHRpb24sIGRhdGEpKSByZXR1cm4gZmFsc2U7XG5cblx0dmFyIHNlbGYgPSB0aGlzLFxuXHRcdHBlZXIgPSBDb25uZWN0aW9uLmNyZWF0ZVdlYlJUQ0Nvbm5lY3Rpb24oe2FkZHJlc3M6cGVlckFkZHJlc3N9LCB0aGlzLnBlZXJzLCB0aGlzLCB7ZmlyZXdhbGw6IHRoaXMuZmlyZXdhbGx9KTtcblxuXHR0aGlzLmFkZFBlZXIocGVlcik7XG5cblx0cGVlci5vbignY2xvc2UnLCBmdW5jdGlvbigpe1xuXHRcdHNlbGYucGVlcnMucmVtb3ZlKHBlZXIpO1xuXHRcdHNlbGYuZW1pdHRlci5lbWl0KCdkaXNjb25uZWN0aW9uJywgcGVlcik7XG5cdH0pO1xuXG5cdHBlZXIucmVhZE9mZmVyKGRlc2NyaXB0aW9uKTtcblx0cGVlci53cml0ZUFuc3dlcigpO1xuXG5cdHRoaXMuZW1pdHRlci5lbWl0KCdjb25uZWN0aW9uJywgcGVlcik7XG59O1xuXG5Db25uZWN0aW9uLnByb3RvdHlwZS5yZWFkUmVsYXllZEFuc3dlciA9IGZ1bmN0aW9uKHBlZXJBZGRyZXNzLCBkZXNjcmlwdGlvbil7XG5cdHZhciBwZWVyID0gdGhpcy5nZXRQZWVyKHBlZXJBZGRyZXNzKTtcblxuXHRpZighcGVlcil7XG5cdFx0dGhpcy5lbWl0dGVyLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdVbmtub3duIHBlZXIgYXQgYWRkcmVzczogJyArIHBlZXJBZGRyZXNzKSk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cGVlci5yZWFkQW5zd2VyKGRlc2NyaXB0aW9uKTtcbn07XG5cbkNvbm5lY3Rpb24ucHJvdG90eXBlLmNsb3NlID0gbm90SW1wbGVtZW50ZWQ7IC8vIGltcGxlbWVudGVkIGhpZ2hlciB1cFxuQ29ubmVjdGlvbi5wcm90b3R5cGUuZ2V0UmVhZHlTdGF0ZSA9IG5vdEltcGxlbWVudGVkOyAvLyBpbXBsZW1lbnRlZCBoaWdoZXIgdXBcblxuQ29ubmVjdGlvbi5wcm90b3R5cGUuaXNPcGVuID0gZnVuY3Rpb24oKXtcblx0cmV0dXJuIHRoaXMuZ2V0UmVhZHlTdGF0ZSgpID09PSAnb3Blbic7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbm5lY3Rpb247XG4iLCJ2YXIgaXRzID0gcmVxdWlyZSgnaXRzJyk7XG5cbmZ1bmN0aW9uIG5vb3AoKXt9XG5cbmZ1bmN0aW9uIENvbm5lY3Rpb25NYW5hZ2VyKCl7XG5cdHRoaXMuY29ubmVjdGlvbk1hcCA9IHt9O1xuXHR0aGlzLmNvbm5lY3Rpb25MaXN0ID0gW107XG59XG5cbkNvbm5lY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihhZGRyZXNzKXtcblx0aWYoYWRkcmVzcyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gdGhpcy5jb25uZWN0aW9uTGlzdC5zbGljZSgpO1xuXG5cdHJldHVybiB0aGlzLmNvbm5lY3Rpb25NYXBbYWRkcmVzc107XG59O1xuXG5Db25uZWN0aW9uTWFuYWdlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24oY29ubmVjdGlvbikge1xuXHRpdHMuZGVmaW5lZChjb25uZWN0aW9uKTtcblxuXHR2YXIgYWRkcmVzcyA9IGNvbm5lY3Rpb24uYWRkcmVzcztcblx0aXRzLnN0cmluZyhhZGRyZXNzKTtcblxuXHRpZihhZGRyZXNzIGluIHRoaXMuY29ubmVjdGlvbk1hcCkgcmV0dXJuIGZhbHNlO1xuXHRcblx0dGhpcy5jb25uZWN0aW9uTWFwW2FkZHJlc3NdID0gY29ubmVjdGlvbjtcblx0dGhpcy5jb25uZWN0aW9uTGlzdC5wdXNoKGNvbm5lY3Rpb24pO1xuXG5cdHRoaXMub25BZGQoY29ubmVjdGlvbik7XG5cdHJldHVybiB0cnVlO1xufTtcbkNvbm5lY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5vbkFkZCA9IG5vb3A7XG5cbkNvbm5lY3Rpb25NYW5hZ2VyLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihjb25uZWN0aW9uKXtcblx0aXRzLmRlZmluZWQoY29ubmVjdGlvbik7XG5cblx0dmFyIGFkZHJlc3MgPSBjb25uZWN0aW9uLmFkZHJlc3M7XG5cdGl0cy5zdHJpbmcoYWRkcmVzcyk7XG5cblx0dmFyIG1hcHBlZENvbm5lY3Rpb24gPSB0aGlzLmNvbm5lY3Rpb25NYXBbYWRkcmVzc107XG5cdGlmKCFtYXBwZWRDb25uZWN0aW9uIHx8IG1hcHBlZENvbm5lY3Rpb24gIT09IGNvbm5lY3Rpb24pIHJldHVybiBmYWxzZTtcblxuXHRkZWxldGUgdGhpcy5jb25uZWN0aW9uTWFwW2FkZHJlc3NdO1xuXHRcblx0dmFyIGluZGV4ID0gdGhpcy5jb25uZWN0aW9uTGlzdC5pbmRleE9mKGNvbm5lY3Rpb24pO1xuXHR0aGlzLmNvbm5lY3Rpb25MaXN0LnNwbGljZShpbmRleCwgMSk7XG5cblx0dGhpcy5vblJlbW92ZShjb25uZWN0aW9uKTtcblx0cmV0dXJuIHRydWU7XG59O1xuQ29ubmVjdGlvbk1hbmFnZXIucHJvdG90eXBlLm9uUmVtb3ZlID0gbm9vcDtcblxubW9kdWxlLmV4cG9ydHMgPSBDb25uZWN0aW9uTWFuYWdlcjsiLCJmdW5jdGlvbiBub3RJbXBsZW1lbnRlZCgpe1xuXHR0aHJvdyBuZXcgRXJyb3IoJ1RoaXMgbWV0aG9kIGlzIG5vdCBpbXBsZW1lbnRlZCcpO1xufVxuXG5mdW5jdGlvbiBKU09OUHJvdG9jb2woKXt9XG5cbkpTT05Qcm90b2NvbC5wcm90b3R5cGUuUFJPVE9DT0xfTkFNRSA9ICdwJztcblxuSlNPTlByb3RvY29sLnByb3RvdHlwZS5NRVNTQUdFX1RZUEUgPSB7XG5cdERJUkVDVDogMCwgLy8gWzAsIG1lc3NhZ2VdXG5cblx0UlRDX09GRkVSOiAzLCAvLyBbMywgZGVzY3JpcHRpb24sIGRhdGFdXG5cdFJUQ19BTlNXRVI6IDQsIC8vIFs0LCBkZXNjcmlwdGlvbl1cblx0UlRDX0lDRV9DQU5ESURBVEU6IDUsIC8vIFs1LCBjYW5kaWRhdGVdXG5cblx0UkVMQVk6IDYsIC8vIFs2LCBhZGRyZXNzLCBtZXNzYWdlXVxuXHRSRUxBWUVEOiA3IC8vIFs3LCBhZGRyZXNzLCBtZXNzYWdlXVxufTtcblxuSlNPTlByb3RvY29sLnByb3RvdHlwZS5yZWFkUmF3ID0gZnVuY3Rpb24obWVzc2FnZSl7XG5cdGlmKG1lc3NhZ2UgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcil7XG5cdFx0dGhpcy5yZWFkQXJyYXlCdWZmZXIobWVzc2FnZSk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5yZWFkUHJvdG9jb2xNZXNzYWdlKEpTT04ucGFyc2UobWVzc2FnZSkpO1xuXHR9XHRcbn07XG5cbkpTT05Qcm90b2NvbC5wcm90b3R5cGUucmVhZFByb3RvY29sTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2Upe1xuXHR2YXIgTUVTU0FHRV9UWVBFID0gdGhpcy5NRVNTQUdFX1RZUEUsXG5cdFx0bWVzc2FnZVR5cGUgPSBtZXNzYWdlWzBdO1xuXHRcblx0c3dpdGNoKG1lc3NhZ2VUeXBlKXtcblx0XHQvLyBUaGlzIGlzIGEgbWVzc2FnZSBmcm9tIHRoZSByZW1vdGUgbm9kZSB0byB0aGlzIG9uZS5cblx0XHRjYXNlIE1FU1NBR0VfVFlQRS5ESVJFQ1Q6XG5cdFx0XHR0aGlzLnJlYWRNZXNzYWdlKG1lc3NhZ2VbMV0pO1xuXHRcdFx0YnJlYWs7XG5cblx0XHQvLyBUaGUgbWVzc2FnZSB3YXMgcmVsYXllZCBieSB0aGUgcGVlciBvbiBiZWhhbGYgb2Zcblx0XHQvLyBhIHRoaXJkIHBhcnR5IHBlZXIsIGlkZW50aWZpZWQgYnkgXCJ0aGlyZFBhcnR5UGVlcklkXCIuXG5cdFx0Ly8gVGhpcyBtZWFucyB0aGF0IHRoZSBwZWVyIGlzIGFjdGluZyBhcyBhIHNpZ25hbGxpbmdcblx0XHQvLyBjaGFubmVsIG9uIGJlaGFsZiBvZiB0aGUgdGhpcmQgcGFydHkgcGVlci5cblx0XHRjYXNlIE1FU1NBR0VfVFlQRS5SRUxBWUVEOlxuXHRcdFx0dGhpcy5yZWFkUmVsYXllZE1lc3NhZ2UobWVzc2FnZVsxXSwgbWVzc2FnZVsyXSk7XG5cdFx0XHRicmVhaztcblxuXHRcdC8vIFRoZSBtZXNzYWdlIGlzIGludGVuZGVkIGZvciBhbm90aGVyIHBlZXIsIGlkZW50aWZpZWRcblx0XHQvLyBieSBcInBlZXJJZFwiLCB3aGljaCBpcyBhbHNvIGNvbm5lY3RlZCB0byB0aGlzIG5vZGUuXG5cdFx0Ly8gVGhpcyBtZWFucyB0aGF0IHRoZSBwZWVyIGlzIHVzaW5nIHRoaXMgY29ubmVjdGlvblxuXHRcdC8vIGFzIGEgc2lnbmFsbGluZyBjaGFubmVsIGluIG9yZGVyIHRvIGVzdGFibGlzaCBhIGNvbm5lY3Rpb25cblx0XHQvLyB0byB0aGUgb3RoZXIgcGVlciBpZGVudGlmaWVkIFwicGVlcklkXCIuXG5cdFx0Y2FzZSBNRVNTQUdFX1RZUEUuUkVMQVk6XG5cdFx0XHR0aGlzLnJlYWRSZWxheShtZXNzYWdlWzFdLCBtZXNzYWdlWzJdKTtcblx0XHRcdGJyZWFrO1xuXG5cdFx0ZGVmYXVsdDpcblx0XHRcdHRocm93IG5ldyBFcnJvcignVW5rbm93biBtZXNzYWdlIHR5cGU6ICcgKyBtZXNzYWdlVHlwZSk7XG5cdH1cbn07XG5cbkpTT05Qcm90b2NvbC5wcm90b3R5cGUucmVhZFJlbGF5ZWRNZXNzYWdlID0gZnVuY3Rpb24ob3JpZ2luLCBtZXNzYWdlKXtcblx0dmFyIE1FU1NBR0VfVFlQRSA9IHRoaXMuTUVTU0FHRV9UWVBFLFxuXHRcdG1lc3NhZ2VUeXBlID0gbWVzc2FnZVswXTtcblxuXHRzd2l0Y2gobWVzc2FnZVR5cGUpe1xuXHRcdC8vIEFuIGluaXRpYWwgY29ubmVjdGlvbiByZXF1ZXN0IGZyb20gYSB0aGlyZCBwYXJ0eSBwZWVyXG5cdFx0Y2FzZSBNRVNTQUdFX1RZUEUuUlRDX09GRkVSOlxuXHRcdFx0dGhpcy5yZWFkUmVsYXllZE9mZmVyKG9yaWdpbiwgbWVzc2FnZVsxXSwgbWVzc2FnZVsyXSk7XG5cdFx0XHRicmVhaztcblx0XHRcblx0XHQvLyBBbiBhbnN3ZXIgdG8gYW4gUlRDIG9mZmVyIHNlbnQgZnJvbSB0aGlzIG5vZGVcblx0XHRjYXNlIE1FU1NBR0VfVFlQRS5SVENfQU5TV0VSOlxuXHRcdFx0dGhpcy5yZWFkUmVsYXllZEFuc3dlcihvcmlnaW4sIG1lc3NhZ2VbMV0pO1xuXHRcdFx0YnJlYWs7XG5cdFx0XG5cdFx0Ly8gQW4gSUNFIGNhbmRpZGF0ZSBmcm9tIHRoZSBzb3VyY2Ugbm9kZVxuXHRcdGNhc2UgTUVTU0FHRV9UWVBFLlJUQ19JQ0VfQ0FORElEQVRFOlxuXHRcdFx0dGhpcy5yZWFkUmVsYXllZEljZUNhbmRpZGF0ZShvcmlnaW4sIG1lc3NhZ2VbMV0pO1xuXHRcdFx0YnJlYWs7XG5cblx0XHRkZWZhdWx0OlxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG1lc3NhZ2UgdHlwZTogJyArIG1lc3NhZ2VUeXBlKTtcblx0fVx0XHRcbn07XG5cbkpTT05Qcm90b2NvbC5wcm90b3R5cGUucmVhZE1lc3NhZ2UgPSBub3RJbXBsZW1lbnRlZDtcbkpTT05Qcm90b2NvbC5wcm90b3R5cGUucmVhZEFycmF5QnVmZmVyID0gbm90SW1wbGVtZW50ZWQ7XG5KU09OUHJvdG9jb2wucHJvdG90eXBlLnJlYWRSZWxheSA9IG5vdEltcGxlbWVudGVkO1xuXG5KU09OUHJvdG9jb2wucHJvdG90eXBlLnJlYWRSZWxheWVkT2ZmZXIgPSBub3RJbXBsZW1lbnRlZDtcbkpTT05Qcm90b2NvbC5wcm90b3R5cGUucmVhZFJlbGF5ZWRBbnN3ZXIgPSBub3RJbXBsZW1lbnRlZDtcbkpTT05Qcm90b2NvbC5wcm90b3R5cGUucmVhZFJlbGF5ZWRJY2VDYW5kaWRhdGUgPSBub3RJbXBsZW1lbnRlZDtcblxuSlNPTlByb3RvY29sLnByb3RvdHlwZS53cml0ZVJhdyA9IG5vdEltcGxlbWVudGVkO1xuXG5KU09OUHJvdG9jb2wucHJvdG90eXBlLndyaXRlUHJvdG9jb2xNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSl7XG5cdHZhciBzZXJpYWxpemVkTWVzc2FnZSA9IEpTT04uc3RyaW5naWZ5KG1lc3NhZ2UpO1xuXHR0aGlzLndyaXRlUmF3KHNlcmlhbGl6ZWRNZXNzYWdlKTtcbn07XG5cbkpTT05Qcm90b2NvbC5wcm90b3R5cGUud3JpdGVNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSl7XG5cdGlmKG1lc3NhZ2UgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcil7XG5cdFx0dGhpcy53cml0ZVJhdyhtZXNzYWdlKTtcblx0fSBlbHNlIHtcblx0XHR0aGlzLndyaXRlU3RyaW5nTWVzc2FnZShtZXNzYWdlKTtcblx0fVxufTtcblxuSlNPTlByb3RvY29sLnByb3RvdHlwZS53cml0ZVN0cmluZ01lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKXtcblx0dGhpcy53cml0ZVByb3RvY29sTWVzc2FnZShbXG5cdFx0dGhpcy5NRVNTQUdFX1RZUEUuRElSRUNULFxuXHRcdG1lc3NhZ2Vcblx0XSk7XG59O1xuXG5KU09OUHJvdG9jb2wucHJvdG90eXBlLndyaXRlUmVsYXllZE1lc3NhZ2UgPSBmdW5jdGlvbihvcmlnaW4sIG1lc3NhZ2Upe1xuXHR0aGlzLndyaXRlUHJvdG9jb2xNZXNzYWdlKFtcblx0XHR0aGlzLk1FU1NBR0VfVFlQRS5SRUxBWUVELFxuXHRcdG9yaWdpbixcblx0XHRtZXNzYWdlXG5cdF0pO1xufTtcblxuSlNPTlByb3RvY29sLnByb3RvdHlwZS53cml0ZVJlbGF5TWVzc2FnZSA9IGZ1bmN0aW9uKGRlc3RpbmF0aW9uLCBtZXNzYWdlKXtcblx0dGhpcy53cml0ZVByb3RvY29sTWVzc2FnZShbXG5cdFx0dGhpcy5NRVNTQUdFX1RZUEUuUkVMQVksXG5cdFx0ZGVzdGluYXRpb24sXG5cdFx0bWVzc2FnZVxuXHRdKTtcbn07XG5cbkpTT05Qcm90b2NvbC5wcm90b3R5cGUud3JpdGVSZWxheUFuc3dlciA9IGZ1bmN0aW9uKGRlc3RpbmF0aW9uLCBkZXNjcmlwdGlvbil7XG5cdHRoaXMud3JpdGVSZWxheU1lc3NhZ2UoZGVzdGluYXRpb24sIFtcblx0XHR0aGlzLk1FU1NBR0VfVFlQRS5SVENfQU5TV0VSLFxuXHRcdGRlc2NyaXB0aW9uXG5cdF0pO1xufTtcblxuSlNPTlByb3RvY29sLnByb3RvdHlwZS53cml0ZVJlbGF5SWNlQ2FuZGlkYXRlID0gZnVuY3Rpb24oZGVzdGluYXRpb24sIGNhbmRpZGF0ZSl7XG5cdHRoaXMud3JpdGVSZWxheU1lc3NhZ2UoZGVzdGluYXRpb24sIFtcblx0XHR0aGlzLk1FU1NBR0VfVFlQRS5SVENfSUNFX0NBTkRJREFURSxcblx0XHRjYW5kaWRhdGVcblx0XSk7XG59O1xuXG5KU09OUHJvdG9jb2wucHJvdG90eXBlLndyaXRlUmVsYXlPZmZlciA9IGZ1bmN0aW9uKGRlc3RpbmF0aW9uLCBkZXNjcmlwdGlvbiwgZGF0YSl7XG5cdHRoaXMud3JpdGVSZWxheU1lc3NhZ2UoZGVzdGluYXRpb24sIFtcblx0XHR0aGlzLk1FU1NBR0VfVFlQRS5SVENfT0ZGRVIsXG5cdFx0ZGVzY3JpcHRpb24sXG5cdFx0ZGF0YVxuXHRdKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSlNPTlByb3RvY29sOyIsInZhciBFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuXHRDb25uZWN0aW9uTWFuYWdlciA9IHJlcXVpcmUoJy4vQ29ubmVjdGlvbk1hbmFnZXIuanMnKSxcblx0V2ViU29ja2V0Q29ubmVjdGlvbiA9IHJlcXVpcmUoJy4vV2ViU29ja2V0Q29ubmVjdGlvbi5qcycpLFxuXHRpdHMgPSByZXF1aXJlKCdpdHMnKTtcblxucmVxdWlyZSgnLi9XZWJSdGNDb25uZWN0aW9uJyk7XG5cbmZ1bmN0aW9uIFAoZW1pdHRlciwgY29ubmVjdGlvbk1hbmFnZXIsIG9wdGlvbnMpe1xuXHRpdHMuZGVmaW5lZChlbWl0dGVyKTtcblx0aXRzLmRlZmluZWQoY29ubmVjdGlvbk1hbmFnZXIpO1xuXG5cdHRoaXMuZW1pdHRlciA9IGVtaXR0ZXI7XG5cdHRoaXMucGVlcnMgPSBjb25uZWN0aW9uTWFuYWdlcjtcblxuXHR0aGlzLnBlZXJzLm9uQWRkID0gZnVuY3Rpb24ocGVlcil7XG5cdFx0ZW1pdHRlci5lbWl0KCdjb25uZWN0aW9uJywgcGVlcik7XG5cdH07XG5cblx0dGhpcy5wZWVycy5vblJlbW92ZSA9IGZ1bmN0aW9uKHBlZXIpe1xuXHRcdGVtaXR0ZXIuZW1pdCgnZGlzY29ubmVjdGlvbicsIHBlZXIpO1xuXHR9O1xuXG5cdGlmKG9wdGlvbnMgJiYgb3B0aW9ucy5maXJld2FsbCkgdGhpcy5maXJld2FsbCA9IG9wdGlvbnMuZmlyZXdhbGw7XG59XG5cblAuY3JlYXRlID0gZnVuY3Rpb24ob3B0aW9ucyl7XG5cdHZhciBlbWl0dGVyID0gbmV3IEVtaXR0ZXIoKSxcblx0XHRjb25uZWN0aW9uTWFuYWdlciA9IG5ldyBDb25uZWN0aW9uTWFuYWdlcigpO1xuXG5cdHJldHVybiBuZXcgUChlbWl0dGVyLCBjb25uZWN0aW9uTWFuYWdlciwgb3B0aW9ucyk7XG59O1xuXG5QLnByb3RvdHlwZS5nZXRQZWVycyA9IGZ1bmN0aW9uKCl7XG5cdHJldHVybiB0aGlzLnBlZXJzLmdldCgpO1xufTtcblxuUC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKGFkZHJlc3Mpe1xuXHRpdHMuc3RyaW5nKGFkZHJlc3MpO1xuXG5cdHZhciBwZWVycyA9IHRoaXMucGVlcnMsXG5cdFx0cGVlciA9IFdlYlNvY2tldENvbm5lY3Rpb24uY3JlYXRlKGFkZHJlc3MsIHRoaXMucGVlcnMsIHtmaXJld2FsbDogdGhpcy5maXJld2FsbH0pO1xuXG5cdHBlZXJzLmFkZChwZWVyKTtcblxuXHRwZWVyLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XG5cdFx0cGVlcnMucmVtb3ZlKHBlZXIpO1xuXHR9KTtcblxuXHRyZXR1cm4gcGVlcjtcbn07XG5cblAucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oKXtcblx0dGhpcy5lbWl0dGVyLm9uLmFwcGx5KHRoaXMuZW1pdHRlciwgYXJndW1lbnRzKTtcblx0cmV0dXJuIHRoaXM7XG59O1xuXG5QLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKCl7XG5cdHRoaXMuZW1pdHRlci5yZW1vdmVMaXN0ZW5lci5hcHBseSh0aGlzLmVtaXR0ZXIsIGFyZ3VtZW50cyk7XG5cdHJldHVybiB0aGlzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBQO1xuIiwiLypnbG9iYWxcblx0XHRSVENQZWVyQ29ubmVjdGlvbixcblx0XHR3ZWJraXRSVENQZWVyQ29ubmVjdGlvbixcblx0XHRtb3pSVENQZWVyQ29ubmVjdGlvbixcblx0XHRSVENTZXNzaW9uRGVzY3JpcHRpb24sXG5cdFx0bW96UlRDU2Vzc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFJUQ0ljZUNhbmRpZGF0ZSxcblx0XHRtb3pSVENJY2VDYW5kaWRhdGVcbiovXG5cbnZhciBDb25uZWN0aW9uID0gcmVxdWlyZSgnLi9Db25uZWN0aW9uLmpzJyksXG5cdGl0cyA9IHJlcXVpcmUoJ2l0cycpO1xuXG52YXIgbmF0aXZlUlRDUGVlckNvbm5lY3Rpb24gPSAodHlwZW9mIFJUQ1BlZXJDb25uZWN0aW9uICE9PSAndW5kZWZpbmVkJyk/IFJUQ1BlZXJDb25uZWN0aW9uIDpcblx0XHRcdFx0XHRcdFx0ICAodHlwZW9mIHdlYmtpdFJUQ1BlZXJDb25uZWN0aW9uICE9PSAndW5kZWZpbmVkJyk/IHdlYmtpdFJUQ1BlZXJDb25uZWN0aW9uIDpcblx0XHRcdFx0XHRcdFx0ICAodHlwZW9mIG1velJUQ1BlZXJDb25uZWN0aW9uICE9PSAndW5kZWZpbmVkJyk/IG1velJUQ1BlZXJDb25uZWN0aW9uIDpcblx0XHRcdFx0XHRcdFx0ICB1bmRlZmluZWQ7XG5cbnZhciBuYXRpdmVSVENTZXNzaW9uRGVzY3JpcHRpb24gPSAodHlwZW9mIFJUQ1Nlc3Npb25EZXNjcmlwdGlvbiAhPT0gJ3VuZGVmaW5lZCcpPyBSVENTZXNzaW9uRGVzY3JpcHRpb24gOlxuXHRcdFx0XHRcdFx0XHRcdCAgKHR5cGVvZiBtb3pSVENTZXNzaW9uRGVzY3JpcHRpb24gIT09ICd1bmRlZmluZWQnKT8gbW96UlRDU2Vzc2lvbkRlc2NyaXB0aW9uIDpcblx0XHRcdFx0XHRcdFx0XHQgIHVuZGVmaW5lZDtcbnZhciBuYXRpdmVSVENJY2VDYW5kaWRhdGUgPSAodHlwZW9mIFJUQ0ljZUNhbmRpZGF0ZSAhPT0gJ3VuZGVmaW5lZCcpPyBSVENJY2VDYW5kaWRhdGUgOlxuXHRcdFx0XHRcdFx0XHQodHlwZW9mIG1velJUQ0ljZUNhbmRpZGF0ZSAhPT0gJ3VuZGVmaW5lZCcpPyBtb3pSVENJY2VDYW5kaWRhdGUgOlxuXHRcdFx0XHRcdFx0XHR1bmRlZmluZWQ7XG5cbnZhciBsb2cgPSBmdW5jdGlvbigpe307XG5cbmlmKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5QX0RFQlVHR0lOR19FTkFCTEVEKXtcblx0bG9nID0gZnVuY3Rpb24obGFiZWwsIGV2ZW50LCBvYmope1xuXHRcdHdpbmRvdy5jb25zb2xlLmRlYnVnKGxhYmVsLCBldmVudCwgb2JqKTtcblx0fTtcbn1cblxuZnVuY3Rpb24gV2ViUlRDQ29ubmVjdGlvbihhZGRyZXNzLCBwZWVycywgcnRjQ29ubmVjdGlvbiwgc2lnbmFsaW5nQ2hhbm5lbCwgb3B0aW9ucyl7XG5cdHZhciBzZWxmID0gdGhpcztcblxuXHRpdHMuc3RyaW5nKGFkZHJlc3MpO1xuXHRpdHMuZGVmaW5lZChwZWVycyk7XG5cdGl0cy5kZWZpbmVkKHJ0Y0Nvbm5lY3Rpb24pO1xuXHRpdHMuZGVmaW5lZChzaWduYWxpbmdDaGFubmVsKTtcblxuXHRDb25uZWN0aW9uLmNhbGwodGhpcywgYWRkcmVzcywgcGVlcnMsIG9wdGlvbnMpO1xuXG5cdHRoaXMuc2lnbmFsaW5nQ2hhbm5lbCA9IHNpZ25hbGluZ0NoYW5uZWw7XG5cdHRoaXMucnRjQ29ubmVjdGlvbiA9IHJ0Y0Nvbm5lY3Rpb247XG5cdHRoaXMucnRjRGF0YUNoYW5uZWwgPSBydGNDb25uZWN0aW9uLmNyZWF0ZURhdGFDaGFubmVsKHRoaXMuUFJPVE9DT0xfTkFNRSwge3Byb3RvY29sOiB0aGlzLlBST1RPQ09MX05BTUV9KTtcblxuXG5cdC8vIEJ1ZyBpbiBGRiBzZWVtcyB0byBnYXJiYWdlIGNvbGxlY3QgdGhlIHN0YWxlIHJlZiBjYXVzaW5nIGl0IHRvIGNsb3NlXG5cdC8vIHRoZSBwcmV2ZW50cyBpdCBmcm9tIGJlaW5nIGxvc3QgaW4gYSBHQyBldmVudFxuXHR0aGlzLl9pbml0aWFsUnRjRGF0YUNoYW5uZWwgPSB0aGlzLnJ0Y0RhdGFDaGFubmVsO1xuXG5cblx0dGhpcy5jbG9zZSA9IHJ0Y0Nvbm5lY3Rpb24uY2xvc2UuYmluZChydGNDb25uZWN0aW9uKTtcblxuXHR0aGlzLnJ0Y0Nvbm5lY3Rpb24uYWRkRXZlbnRMaXN0ZW5lcignaWNlY2FuZGlkYXRlJywgZnVuY3Rpb24oZXZlbnQpe1xuXHRcdGlmKCFldmVudC5jYW5kaWRhdGUpIHJldHVybjtcblx0XHRsb2coJ2ljZSBjYW5kaWRhdGUnLCBldmVudCwgc2VsZik7XG5cdFx0c2VsZi5zaWduYWxpbmdDaGFubmVsLndyaXRlUmVsYXlJY2VDYW5kaWRhdGUoYWRkcmVzcywgZXZlbnQuY2FuZGlkYXRlKTtcblx0fSk7XG5cblx0dGhpcy5ydGNDb25uZWN0aW9uLmFkZEV2ZW50TGlzdGVuZXIoJ2RhdGFjaGFubmVsJywgZnVuY3Rpb24oZXZlbnQpe1xuXHRcdGxvZygnZGF0YWNoYW5uZWwnLCBldmVudCwgc2VsZik7XG5cblx0XHR2YXIgcnRjRGF0YUNoYW5uZWwgPSBzZWxmLnJ0Y0RhdGFDaGFubmVsID0gZXZlbnQuY2hhbm5lbDtcblx0XHRydGNEYXRhQ2hhbm5lbC5hZGRFdmVudExpc3RlbmVyKCdvcGVuJywgZnVuY3Rpb24oZXZlbnQpe1xuXHRcdFx0bG9nKCdyZW1vdGUgZGF0YWNoYW5uZWwgb3BlbicsIGV2ZW50LCBzZWxmKTtcblx0XHRcdHNlbGYuZW1pdHRlci5lbWl0KCdvcGVuJywgZXZlbnQpO1xuXHRcdH0pO1xuXG5cdFx0cnRjRGF0YUNoYW5uZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xvc2UnLCBmdW5jdGlvbihldmVudCl7XG5cdFx0XHRsb2coJ3JlbW90ZSBkYXRhY2hhbm5lbCBjbG9zZScsIGV2ZW50LCBzZWxmKTtcblx0XHRcdHNlbGYuZW1pdHRlci5lbWl0KCdjbG9zZScsIGV2ZW50KTtcblx0XHR9KTtcblxuXHRcdHJ0Y0RhdGFDaGFubmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZnVuY3Rpb24oZXZlbnQpe1xuXHRcdFx0bG9nKCdyZW1vdGUgZGF0YWNoYW5uZWwgZXJyb3InLCBldmVudCwgc2VsZik7XG5cdFx0XHRzZWxmLmVtaXR0ZXIuZW1pdCgnZXJyb3InLCBldmVudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRoaXMucnRjRGF0YUNoYW5uZWwuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKG1lc3NhZ2Upe1xuXHRcdGxvZygnbG9jYWwgZGF0YWNoYW5uZWwgbWVzc2FnZScsIG1lc3NhZ2UsIHNlbGYpO1xuXHRcdHNlbGYucmVhZFJhdyhtZXNzYWdlLmRhdGEpO1xuXHR9KTtcblxuXHR0aGlzLnJ0Y0RhdGFDaGFubmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZnVuY3Rpb24oZXZlbnQpe1xuXHRcdGxvZygnbG9jYWwgZGF0YWNoYW5uZWwgZXJyb3InLCBldmVudCwgc2VsZik7XG5cdFx0c2VsZi5lbWl0dGVyLmVtaXQoJ2Vycm9yJywgZXZlbnQpO1xuXHR9KTtcblxuXHR0aGlzLnJ0Y0RhdGFDaGFubmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2Nsb3NlJywgZnVuY3Rpb24oZXZlbnQpe1xuXHRcdGxvZygnbG9jYWwgZGF0YWNoYW5uZWwgY2xvc2UnLCBldmVudCwgc2VsZik7XG5cdFx0c2VsZi5lbWl0dGVyLmVtaXQoJ2Nsb3NlJywgZXZlbnQpO1xuXHR9KTtcbn1cblxudmFyIERFRkFVTFRfUlRDX0NPTkZJR1VSQVRJT04gPSBudWxsO1xudmFyIERFRkFVTFRfUlRDX09GRkVSX09QVElPTlMgPSB7XG5cdG9mZmVyVG9SZWNlaXZlQXVkaW86IGZhbHNlLFxuXHRvZmZlclRvUmVjZWl2ZVZpZGVvOiBmYWxzZSxcblx0aWNlUmVzdGFydDogZmFsc2Vcbn07XG5cbi8vREVGQVVMVF9SVENfT0ZGRVJfT1BUSU9OU1xuV2ViUlRDQ29ubmVjdGlvbi5jcmVhdGUgPSBmdW5jdGlvbihjb25maWcsIHBlZXJzLCBzaWduYWxpbmdDaGFubmVsLCBvcHRpb25zKXtcblx0dmFyIHJ0Y0NvbmZpZ3VyYXRpb24gPSBjb25maWcucnRjQ29uZmlndXJhdGlvbiB8fCBERUZBVUxUX1JUQ19DT05GSUdVUkFUSU9OLFxuXHRcdHJ0Y0Nvbm5lY3Rpb24gPSBuZXcgbmF0aXZlUlRDUGVlckNvbm5lY3Rpb24ocnRjQ29uZmlndXJhdGlvbik7XG5cblx0cmV0dXJuIG5ldyBXZWJSVENDb25uZWN0aW9uKGNvbmZpZy5hZGRyZXNzLCBwZWVycywgcnRjQ29ubmVjdGlvbiwgc2lnbmFsaW5nQ2hhbm5lbCwgb3B0aW9ucyk7XG59O1xuXG5XZWJSVENDb25uZWN0aW9uLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoQ29ubmVjdGlvbi5wcm90b3R5cGUpO1xuXG5XZWJSVENDb25uZWN0aW9uLnByb3RvdHlwZS53cml0ZVJhdyA9IGZ1bmN0aW9uKG1lc3NhZ2Upe1xuXHRzd2l0Y2godGhpcy5ydGNEYXRhQ2hhbm5lbC5yZWFkeVN0YXRlKXtcblx0XHRjYXNlICdjb25uZWN0aW5nJzpcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2FuXFwndCBzZW5kIGEgbWVzc2FnZSB3aGlsZSBSVENEYXRhQ2hhbm5lbCBjb25uZWN0aW5nJyk7XG5cdFx0Y2FzZSAnb3Blbic6XG5cdFx0XHR0aGlzLnJ0Y0RhdGFDaGFubmVsLnNlbmQobWVzc2FnZSk7XG5cdFx0XHRsb2coJ3NlbnQgbWVzc2FnZSB0byByZW1vdGUnLCBtZXNzYWdlLCB0aGlzKTtcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgJ2Nsb3NpbmcnOlxuXHRcdGNhc2UgJ2Nsb3NlZCc6XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3Qgc2VuZCBhIG1lc3NhZ2Ugd2hpbGUgUlRDRGF0YUNoYW5uZWwgaXMgY2xvc2luZyBvciBjbG9zZWQnKTtcblx0fVxufTtcblxuV2ViUlRDQ29ubmVjdGlvbi5wcm90b3R5cGUucmVhZEFuc3dlciA9IGZ1bmN0aW9uKGRlc2NyaXB0aW9uKXtcblx0dmFyIHJ0Y1Nlc3Npb25EZXNjcmlwdGlvbiA9IG5ldyBuYXRpdmVSVENTZXNzaW9uRGVzY3JpcHRpb24oZGVzY3JpcHRpb24pO1xuXG5cdHRoaXMucnRjQ29ubmVjdGlvbi5zZXRSZW1vdGVEZXNjcmlwdGlvbihydGNTZXNzaW9uRGVzY3JpcHRpb24pO1xufTtcblxuV2ViUlRDQ29ubmVjdGlvbi5wcm90b3R5cGUucmVhZE9mZmVyID0gZnVuY3Rpb24oZGVzY3JpcHRpb24pe1xuXHR2YXIgcnRjU2Vzc2lvbkRlc2NyaXB0aW9uID0gbmV3IG5hdGl2ZVJUQ1Nlc3Npb25EZXNjcmlwdGlvbihkZXNjcmlwdGlvbik7XG5cdHRoaXMucnRjQ29ubmVjdGlvbi5zZXRSZW1vdGVEZXNjcmlwdGlvbihydGNTZXNzaW9uRGVzY3JpcHRpb24pO1xufTtcblxuV2ViUlRDQ29ubmVjdGlvbi5wcm90b3R5cGUucmVhZEljZUNhbmRpZGF0ZSA9IGZ1bmN0aW9uKGNhbmRpZGF0ZSl7XG5cdHRoaXMucnRjQ29ubmVjdGlvbi5hZGRJY2VDYW5kaWRhdGUobmV3IG5hdGl2ZVJUQ0ljZUNhbmRpZGF0ZShjYW5kaWRhdGUpKTtcbn07XG5cbldlYlJUQ0Nvbm5lY3Rpb24ucHJvdG90eXBlLndyaXRlQW5zd2VyID0gZnVuY3Rpb24oKXtcblx0dmFyIGVtaXR0ZXIgPSB0aGlzLmVtaXR0ZXIsXG5cdFx0YWRkcmVzcyA9IHRoaXMuYWRkcmVzcyxcblx0XHRydGNDb25uZWN0aW9uID0gdGhpcy5ydGNDb25uZWN0aW9uLFxuXHRcdHNpZ25hbGluZ0NoYW5uZWwgPSB0aGlzLnNpZ25hbGluZ0NoYW5uZWw7XG5cblx0ZnVuY3Rpb24gb25FcnJvcihlcnIpeyBlbWl0dGVyLmVtaXQoJ2Vycm9yJywgZXJyKTsgfVxuXG5cdHJ0Y0Nvbm5lY3Rpb24uY3JlYXRlQW5zd2VyKGZ1bmN0aW9uKGRlc2NyaXB0aW9uKXtcblx0XHRydGNDb25uZWN0aW9uLnNldExvY2FsRGVzY3JpcHRpb24oZGVzY3JpcHRpb24sIGZ1bmN0aW9uKCl7XG5cdFx0XHRzaWduYWxpbmdDaGFubmVsLndyaXRlUmVsYXlBbnN3ZXIoYWRkcmVzcywgZGVzY3JpcHRpb24pO1xuXHRcdH0sIG9uRXJyb3IpO1xuXHR9LCBvbkVycm9yKTtcbn07XG5cbldlYlJUQ0Nvbm5lY3Rpb24ucHJvdG90eXBlLndyaXRlT2ZmZXIgPSBmdW5jdGlvbihjb25maWcpe1xuXHR2YXIgZW1pdHRlciA9IHRoaXMuZW1pdHRlcixcblx0XHRhZGRyZXNzID0gdGhpcy5hZGRyZXNzLFxuXHRcdHJ0Y0Nvbm5lY3Rpb24gPSB0aGlzLnJ0Y0Nvbm5lY3Rpb24sXG5cdFx0c2lnbmFsaW5nQ2hhbm5lbCA9IHRoaXMuc2lnbmFsaW5nQ2hhbm5lbDtcblxuXHRmdW5jdGlvbiBvbkVycm9yKGVycil7IGVtaXR0ZXIuZW1pdCgnZXJyb3InLCBlcnIpOyB9XG5cblx0cnRjQ29ubmVjdGlvbi5jcmVhdGVPZmZlcihmdW5jdGlvbihkZXNjcmlwdGlvbil7XG5cdFx0cnRjQ29ubmVjdGlvbi5zZXRMb2NhbERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uLCBmdW5jdGlvbigpe1xuXHRcdFx0c2lnbmFsaW5nQ2hhbm5lbC53cml0ZVJlbGF5T2ZmZXIoYWRkcmVzcywgZGVzY3JpcHRpb24sIGNvbmZpZy5vZmZlckRhdGEpO1xuXHRcdH0sIG9uRXJyb3IpO1xuXHR9LCBvbkVycm9yLCBjb25maWcucnRjT2ZmZXJPcHRpb25zIHx8IERFRkFVTFRfUlRDX09GRkVSX09QVElPTlMpO1xufTtcblxuV2ViUlRDQ29ubmVjdGlvbi5wcm90b3R5cGUuZ2V0UmVhZHlTdGF0ZSA9IGZ1bmN0aW9uKCl7XG5cdHJldHVybiB0aGlzLnJ0Y0RhdGFDaGFubmVsLnJlYWR5U3RhdGU7XG59O1xuXG4vLyBTb2x2ZXMgdGhlIGNpcmN1bGFyIGRlcGVuZGVuY3kgd2l0aCBDb25uZWN0aW9uLmpzXG5Db25uZWN0aW9uLmNyZWF0ZVdlYlJUQ0Nvbm5lY3Rpb24gPSBXZWJSVENDb25uZWN0aW9uLmNyZWF0ZTtcblxubW9kdWxlLmV4cG9ydHMgPSBXZWJSVENDb25uZWN0aW9uO1xuIiwidmFyIENvbm5lY3Rpb24gPSByZXF1aXJlKCcuL0Nvbm5lY3Rpb24uanMnKTtcblxudmFyIFdlYlNvY2tldFN0YXRlID0ge1xuXHRDT05ORUNUSU5HOiAwLFxuXHRPUEVOOiAxLFxuXHRDTE9TSU5HOiAyLFxuXHRDTE9TRUQ6IDNcbn07XG5cbmlmKHR5cGVvZiBXZWJTb2NrZXQgIT09ICd1bmRlZmluZWQnKXtcblx0V2ViU29ja2V0U3RhdGUgPSBXZWJTb2NrZXQ7XG59XG5cbmZ1bmN0aW9uIFdlYlNvY2tldENvbm5lY3Rpb24oYWRkcmVzcywgcGVlcnMsIHdlYlNvY2tldCwgb3B0aW9ucyl7XG5cdHZhciBzZWxmID0gdGhpcztcblxuXHRDb25uZWN0aW9uLmNhbGwodGhpcywgYWRkcmVzcywgcGVlcnMsIG9wdGlvbnMpO1xuXG5cdHRoaXMud2ViU29ja2V0ID0gd2ViU29ja2V0O1xuXG5cdHRoaXMuY2xvc2UgPSB3ZWJTb2NrZXQuY2xvc2UuYmluZCh3ZWJTb2NrZXQpO1xuXG5cdHRoaXMud2ViU29ja2V0LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihtZXNzYWdlKXtcblx0XHRzZWxmLnJlYWRSYXcobWVzc2FnZS5kYXRhKTtcblx0fSk7XG5cblx0dGhpcy53ZWJTb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignb3BlbicsIGZ1bmN0aW9uKGV2ZW50KXtcblx0XHRzZWxmLmVtaXR0ZXIuZW1pdCgnb3BlbicsIGV2ZW50KTtcblx0fSk7XG5cblx0dGhpcy53ZWJTb2NrZXQuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBmdW5jdGlvbihldmVudCl7XG5cdFx0c2VsZi5lbWl0dGVyLmVtaXQoJ2Vycm9yJywgZXZlbnQpO1xuXHR9KTtcblxuXHR0aGlzLndlYlNvY2tldC5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsIGZ1bmN0aW9uKGV2ZW50KXtcblx0XHRzZWxmLmVtaXR0ZXIuZW1pdCgnY2xvc2UnLCBldmVudCk7XG5cdH0pO1xufVxuXG5XZWJTb2NrZXRDb25uZWN0aW9uLmNyZWF0ZSA9IGZ1bmN0aW9uKGFkZHJlc3MsIHBlZXJzLCBvcHRpb25zKXtcblx0dmFyIHdlYlNvY2tldCA9IG5ldyBXZWJTb2NrZXQoYWRkcmVzcywgV2ViU29ja2V0Q29ubmVjdGlvbi5wcm90b3R5cGUuUFJPVE9DT0xfTkFNRSk7XG5cdHJldHVybiBuZXcgV2ViU29ja2V0Q29ubmVjdGlvbihhZGRyZXNzLCBwZWVycywgd2ViU29ja2V0LCBvcHRpb25zKTtcbn07XG5cbldlYlNvY2tldENvbm5lY3Rpb24ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShDb25uZWN0aW9uLnByb3RvdHlwZSk7XG5XZWJTb2NrZXRDb25uZWN0aW9uLnByb3RvdHlwZS53cml0ZVJhdyA9IGZ1bmN0aW9uKG1lc3NhZ2Upe1xuXHRzd2l0Y2godGhpcy53ZWJTb2NrZXQucmVhZHlTdGF0ZSl7XG5cdFx0Y2FzZSBXZWJTb2NrZXRTdGF0ZS5DT05ORUNUSU5HOlxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5cXCd0IHNlbmQgYSBtZXNzYWdlIHdoaWxlIFdlYlNvY2tldCBjb25uZWN0aW5nJyk7XG5cblx0XHRjYXNlIFdlYlNvY2tldFN0YXRlLk9QRU46XG5cdFx0XHR0aGlzLndlYlNvY2tldC5zZW5kKG1lc3NhZ2UpO1xuXHRcdFx0YnJlYWs7XG5cblx0XHRjYXNlIFdlYlNvY2tldFN0YXRlLkNMT1NJTkc6XG5cdFx0Y2FzZSBXZWJTb2NrZXRTdGF0ZS5DTE9TRUQ6XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NhblxcJ3Qgc2VuZCBhIG1lc3NhZ2Ugd2hpbGUgV2ViU29ja2V0IGlzIGNsb3Npbmcgb3IgY2xvc2VkJyk7XG5cdH1cbn07XG5cbldlYlNvY2tldENvbm5lY3Rpb24ucHJvdG90eXBlLmdldFJlYWR5U3RhdGUgPSBmdW5jdGlvbigpe1xuXHRzd2l0Y2godGhpcy53ZWJTb2NrZXQucmVhZHlTdGF0ZSl7XG5cdFx0Y2FzZSBXZWJTb2NrZXRTdGF0ZS5DT05ORUNUSU5HOlxuXHRcdFx0cmV0dXJuICdjb25uZWN0aW5nJztcblx0XHRjYXNlIFdlYlNvY2tldFN0YXRlLk9QRU46XG5cdFx0XHRyZXR1cm4gJ29wZW4nO1xuXHRcdGNhc2UgV2ViU29ja2V0U3RhdGUuQ0xPU0lORzpcblx0XHRcdHJldHVybiAnY2xvc2luZyc7XG5cdFx0Y2FzZSBXZWJTb2NrZXRTdGF0ZS5DTE9TRUQ6XG5cdFx0XHRyZXR1cm4gJ2Nsb3NlZCc7XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gV2ViU29ja2V0Q29ubmVjdGlvbjtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvaXRzLmpzJyk7IiwiLy8gSGVscGVyc1xyXG52YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XHJcbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XHJcblxyXG52YXIgdGVtcGxhdGVSZWdFeCA9IC8lcy87IC8vIFRoZSB0ZW1wbGF0ZSBwbGFjZWhvbGRlciwgdXNlZCB0byBzcGxpdCBtZXNzYWdlIHRlbXBsYXRlc1xyXG5cclxuLyoqIEEgYmFzaWMgdGVtcGxhdGluZyBmdW5jdGlvbi4gXHJcblx0XHJcblx0VGFrZXMgYSBzdHJpbmcgd2l0aCAwIG9yIG1vcmUgJyVzJyBwbGFjZWhvbGRlcnMgYW5kIGFuIGFycmF5IHRvIHBvcHVsYXRlIGl0IHdpdGguXHJcblxyXG5cdEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlVGVtcGxhdGUgQSBzdHJpbmcgd2hpY2ggbWF5IG9yIG1heSBub3QgaGF2ZSAwIG9yIG1vcmUgJyVzJyB0byBkZW5vdGUgYXJndW1lbnQgcGxhY2VtZW50XHJcblx0QHBhcmFtIHtBcnJheX0gW21lc3NhZ2VBcmd1bWVudHNdIEl0ZW1zIHRvIHBvcHVsYXRlIHRoZSB0ZW1wbGF0ZSB3aXRoXHJcblxyXG5cdEBleGFtcGxlXHJcblx0XHR0ZW1wbGF0ZWRNZXNzYWdlKFwiSGVsbG9cIik7IC8vIHJldHVybnMgXCJIZWxsb1wiXHJcblx0XHR0ZW1wbGF0ZWRNZXNzYWdlKFwiSGVsbG8sICVzXCIsIFtcIndvcmxkXCJdKTsgLy8gcmV0dXJucyBcIkhlbGxvLCB3b3JsZFwiXHJcblx0XHR0ZW1wbGF0ZWRNZXNzYWdlKFwiSGVsbG8sICVzLiBJdCdzICVzIGRlZ3JlZXMgb3V0c2lkZS5cIiwgW1wid29ybGRcIiwgNzJdKTsgLy8gcmV0dXJucyBcIkhlbGxvLCB3b3JsZC4gSXQncyA3MiBkZWdyZWVzIG91dHNpZGVcIlxyXG5cclxuXHRAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzb2x2ZWQgbWVzc2FnZVxyXG4qL1xyXG52YXIgdGVtcGxhdGVkTWVzc2FnZSA9IGZ1bmN0aW9uKG1lc3NhZ2VUZW1wbGF0ZSwgbWVzc2FnZUFyZ3VtZW50cyl7XHJcblx0dmFyIHJlc3VsdCA9IFtdLFxyXG5cdFx0bWVzc2FnZUFycmF5ID0gbWVzc2FnZVRlbXBsYXRlLnNwbGl0KHRlbXBsYXRlUmVnRXgpLFxyXG5cdFx0aW5kZXggPSAwLFxyXG5cdFx0bGVuZ3RoID0gbWVzc2FnZUFycmF5Lmxlbmd0aDtcclxuXHJcblx0Zm9yKDsgaW5kZXggPCBsZW5ndGg7IGluZGV4Kyspe1xyXG5cdFx0cmVzdWx0LnB1c2gobWVzc2FnZUFycmF5W2luZGV4XSk7XHJcblx0XHRyZXN1bHQucHVzaChtZXNzYWdlQXJndW1lbnRzW2luZGV4XSk7XHJcblx0fVxyXG5cclxuXHRyZXR1cm4gcmVzdWx0LmpvaW4oJycpO1xyXG59O1xyXG5cclxuXHJcbi8qKiBHZW5lcmljIGNoZWNrIGZ1bmN0aW9uIHdoaWNoIHRocm93cyBhbiBlcnJvciBpZiBhIGdpdmVuIGV4cHJlc3Npb24gaXMgZmFsc2VcclxuKlxyXG4qXHRUaGUgcGFyYW1zIGxpc3QgaXMgYSBiaXQgY29uZnVzaW5nLCBjaGVjayB0aGUgZXhhbXBsZXMgdG8gc2VlIHRoZSBhdmFpbGFibGUgd2F5cyBvZiBjYWxsaW5nIHRoaXMgZnVuY3Rpb25cclxuKlxyXG4qXHRAcGFyYW0ge0Jvb2xlYW59IGV4cHJlc3Npb24gVGhlIGRldGVybWluYW50IG9mIHdoZXRoZXIgYW4gZXhjZXB0aW9uIGlzIHRocm93blxyXG4qXHRAcGFyYW0ge1N0cmluZ3xPYmplY3R9IFttZXNzYWdlT3JFcnJvclR5cGVdIEEgbWVzc2FnZSBvciBhbiBFcnJvclR5cGUgb2JqZWN0IHRvIHRocm93IGlmIGV4cHJlc3Npb24gaXMgZmFsc2VcclxuKiAgIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gW21lc3NhZ2VPck1lc3NhZ2VBcmdzXSBBIG1lc3NhZ2UsIG1lc3NhZ2UgdGVtcGxhdGUsIG9yIGEgbWVzc2FnZSBhcmd1bWVudFxyXG4qXHRAcGFyYW0gey4uLk9iamVjdH0gW21lc3NhZ2VBcmdzXSBBcmd1bWVudHMgZm9yIGEgcHJvdmlkZWQgbWVzc2FnZSB0ZW1wbGF0ZVxyXG4qXHJcbipcdEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIHRoZSBleHByZXNzaW9uIHBhc3NlZCAgXHJcbipcdEB0aHJvd3Mge0Vycm9yfVxyXG4qXHJcbipcdEBleGFtcGxlXHJcbipcdFx0aXRzKDAgPCAxMCk7IC8vIHJldHVybnMgdHJ1ZVxyXG4qXHRcdGl0cygwID4gMTApOyAvLyB0aHJvd3MgRXJyb3Igd2l0aCBubyBtZXNzYWdlXHJcbipcdFx0aXRzKDAgPiAxMCwgXCJTb21ldGhpbmcgd2VudCB3cm9uZyFcIik7IC8vIHRocm93cyBFcnJvciB3aXRoIG1lc3NhZ2U6IFwiU29tZXRoaW5nIHdlbnQgd3JvbmchXCJcclxuKlx0XHRpdHMoMCA+IDEwLCBcIiVzIHdlbnQgJXMhXCIsIFwic29tZXRoaW5nXCIsIFwid3JvbmdcIik7IC8vIHRocm93cyBFcnJvciB3aXRoIG1lc3NhZ2U6IFwiU29tZXRoaW5nIHdlbnQgd3JvbmchXCJcclxuKlx0XHRpdHMoMCA+IDEwLCBSYW5nZUVycm9yLCBcIiVzIHdlbnQgJXMhXCIsIFwic29tZXRoaW5nXCIsIFwid3JvbmdcIik7IC8vIHRocm93cyBSYW5nZUVycm9yIHdpdGggbWVzc2FnZTogXCJTb21ldGhpbmcgd2VudCB3cm9uZyFcIlxyXG4qXHRcdGl0cygwID4gMTAsIFJhbmdlRXJyb3IpOyAvLyB0aHJvd3MgUmFuZ2VFcnJvciB3aXRoIG5vIG1lc3NhZ2VcclxuKi9cclxudmFyIGl0cyA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZXhwcmVzc2lvbiwgbWVzc2FnZU9yRXJyb3JUeXBlKXtcclxuXHRpZihleHByZXNzaW9uID09PSBmYWxzZSl7XHJcblx0XHRpZihtZXNzYWdlT3JFcnJvclR5cGUgJiYgdHlwZW9mIG1lc3NhZ2VPckVycm9yVHlwZSAhPT0gXCJzdHJpbmdcIil7IC8vIENoZWNrIGlmIGN1c3RvbSBlcnJvciBvYmplY3QgcGFzc2VkXHJcblx0XHRcdHRocm93IG1lc3NhZ2VPckVycm9yVHlwZShhcmd1bWVudHMubGVuZ3RoID4gMyA/IHRlbXBsYXRlZE1lc3NhZ2UoYXJndW1lbnRzWzJdLCBzbGljZS5jYWxsKGFyZ3VtZW50cywzKSkgOiBhcmd1bWVudHNbMl0pO1x0XHJcblx0XHR9IGVsc2Uge1xyXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYXJndW1lbnRzLmxlbmd0aCA+IDIgPyB0ZW1wbGF0ZWRNZXNzYWdlKG1lc3NhZ2VPckVycm9yVHlwZSwgc2xpY2UuY2FsbChhcmd1bWVudHMsMikpIDogbWVzc2FnZU9yRXJyb3JUeXBlKTtcdFxyXG5cdFx0fVxyXG5cdH1cclxuXHRyZXR1cm4gZXhwcmVzc2lvbjtcclxufTtcclxuXHJcbi8qKiBUaHJvd3MgYSBUeXBlRXJyb3IgaWYgYSBnaXZlbiBleHByZXNzaW9uIGlzIGZhbHNlXHJcbipcclxuKlx0QHBhcmFtIHtCb29sZWFufSBleHByZXNzaW9uIFRoZSBkZXRlcm1pbmFudCBvZiB3aGV0aGVyIGFuIGV4Y2VwdGlvbiBpcyB0aHJvd25cclxuKlx0QHBhcmFtIHtTdHJpbmd9IFttZXNzYWdlXSBBIG1lc3NhZ2Ugb3IgbWVzc2FnZSB0ZW1wbGF0ZSBmb3IgdGhlIGVycm9yIChpZiBpdCBnZXRzIHRocm93bilcclxuKlx0QHBhcmFtIHsuLi5PYmplY3R9IFttZXNzYWdlQXJnc10gQXJndW1lbnRzIGZvciBhIHByb3ZpZGVkIG1lc3NhZ2UgdGVtcGxhdGVcclxuKlxyXG4qXHRAcmV0dXJucyB7Qm9vbGVhbn0gUmV0dXJucyB0aGUgZXhwcmVzc2lvbiBwYXNzZWQgIFxyXG4qXHRAdGhyb3dzIHtUeXBlRXJyb3J9XHJcbipcclxuKlx0QGV4YW1wbGVcclxuKlx0XHRpdHMudHlwZSh0eXBlb2YgXCJUZWFtXCIgPT09IFwic3RyaW5nXCIpOyAvLyByZXR1cm5zIHRydWVcclxuKlx0XHRpdHMudHlwZSh0eXBlb2YgXCJUZWFtXCIgPT09IFwibnVtYmVyXCIpOyAvLyB0aHJvd3MgVHlwZUVycm9yIHdpdGggbm8gbWVzc2FnZVxyXG4qXHRcdGl0cy50eXBlKHZvaWQgMCwgXCJTb21ldGhpbmcgd2VudCB3cm9uZyFcIik7IC8vIHRocm93cyBUeXBlRXJyb3Igd2l0aCBtZXNzYWdlOiBcIlNvbWV0aGluZyB3ZW50IHdyb25nIVwiXHJcbipcdFx0aXRzLnR5cGUodm9pZCAwLCBcIiVzIHdlbnQgJXMhXCIsIFwic29tZXRoaW5nXCIsIFwid3JvbmdcIik7IC8vIHRocm93cyBUeXBlRXJyb3Igd2l0aCBtZXNzYWdlOiBcIlNvbWV0aGluZyB3ZW50IHdyb25nIVwiXHJcbiovXHJcbml0cy50eXBlID0gZnVuY3Rpb24oZXhwcmVzc2lvbiwgbWVzc2FnZSl7XHJcblx0aWYoZXhwcmVzc2lvbiA9PT0gZmFsc2Upe1xyXG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihhcmd1bWVudHMubGVuZ3RoID4gMiA/IHRlbXBsYXRlZE1lc3NhZ2UobWVzc2FnZSwgc2xpY2UuY2FsbChhcmd1bWVudHMsMikpIDogbWVzc2FnZSk7XHJcblx0fVxyXG5cdHJldHVybiBleHByZXNzaW9uO1xyXG59O1xyXG5cclxuLy8gSGVscGVyc1xyXG5pdHMudW5kZWZpbmVkID0gZnVuY3Rpb24oZXhwcmVzc2lvbil7XHJcblx0cmV0dXJuIGl0cy50eXBlLmFwcGx5KG51bGwsIFtleHByZXNzaW9uID09PSB2b2lkIDBdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpKTtcclxufTtcclxuXHJcbml0cy5udWxsID0gZnVuY3Rpb24oZXhwcmVzc2lvbil7XHJcblx0cmV0dXJuIGl0cy50eXBlLmFwcGx5KG51bGwsIFtleHByZXNzaW9uID09PSBudWxsXS5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKSk7XHJcbn07XHJcblxyXG5pdHMuYm9vbGVhbiA9IGZ1bmN0aW9uKGV4cHJlc3Npb24pe1xyXG5cdHJldHVybiBpdHMudHlwZS5hcHBseShudWxsLCBbZXhwcmVzc2lvbiA9PT0gdHJ1ZSB8fCBleHByZXNzaW9uID09PSBmYWxzZSB8fCB0b1N0cmluZy5jYWxsKGV4cHJlc3Npb24pID09PSBcIltvYmplY3QgQm9vbGVhbl1cIl0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xyXG59O1xyXG5cclxuaXRzLmFycmF5ID0gZnVuY3Rpb24oZXhwcmVzc2lvbil7XHJcblx0cmV0dXJuIGl0cy50eXBlLmFwcGx5KG51bGwsIFt0b1N0cmluZy5jYWxsKGV4cHJlc3Npb24pID09PSBcIltvYmplY3QgQXJyYXldXCJdLmNvbmNhdChzbGljZS5jYWxsKGFyZ3VtZW50cywgMSkpKTtcclxufTtcclxuXHJcbml0cy5vYmplY3QgPSBmdW5jdGlvbihleHByZXNzaW9uKXtcclxuXHRyZXR1cm4gaXRzLnR5cGUuYXBwbHkobnVsbCwgW2V4cHJlc3Npb24gPT09IE9iamVjdChleHByZXNzaW9uKV0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xyXG59O1xyXG5cclxuLyoqIFRoaXMgYmxvY2sgY3JlYXRlcyBcclxuKlx0aXRzLmZ1bmN0aW9uXHJcbipcdGl0cy5zdHJpbmdcclxuKlx0aXRzLm51bWJlclxyXG4qXHRpdHMuZGF0ZVxyXG4qXHRpdHMucmVnZXhwXHJcbiovXHJcbihmdW5jdGlvbigpe1xyXG5cdHZhciB0eXBlcyA9IFtcclxuXHRcdFx0WydhcmdzJywnQXJndW1lbnRzJ10sXHJcblx0XHRcdFsnZnVuYycsICdGdW5jdGlvbiddLCBcclxuXHRcdFx0WydzdHJpbmcnLCAnU3RyaW5nJ10sIFxyXG5cdFx0XHRbJ251bWJlcicsICdOdW1iZXInXSwgXHJcblx0XHRcdFsnZGF0ZScsICdEYXRlJ10sIFxyXG5cdFx0XHRbJ3JlZ2V4cCcsICdSZWdFeHAnXVxyXG5cdFx0XSxcclxuXHRcdGluZGV4ID0gMCxcclxuXHRcdGxlbmd0aCA9IHR5cGVzLmxlbmd0aDtcclxuXHJcblx0Zm9yKDsgaW5kZXggPCBsZW5ndGg7IGluZGV4Kyspe1xyXG5cdFx0KGZ1bmN0aW9uKCl7XHJcblx0XHRcdHZhciB0aGVUeXBlID0gdHlwZXNbaW5kZXhdO1xyXG5cdFx0XHRpdHNbdGhlVHlwZVswXV0gPSBmdW5jdGlvbihleHByZXNzaW9uKXtcclxuXHRcdFx0XHRyZXR1cm4gaXRzLnR5cGUuYXBwbHkobnVsbCwgW3RvU3RyaW5nLmNhbGwoZXhwcmVzc2lvbikgPT09ICdbb2JqZWN0ICcgKyB0aGVUeXBlWzFdICsgJ10nXS5jb25jYXQoc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKSk7XHJcblx0XHRcdH07XHJcblx0XHR9KCkpO1xyXG5cdH1cclxufSgpKTtcclxuXHJcbi8vIG9wdGltaXphdGlvbiBmcm9tIHVuZGVyc2NvcmUuanMgYnkgZG9jdW1lbnRjbG91ZCAtLSB1bmRlcnNjb3JlanMub3JnXHJcbmlmICh0eXBlb2YgKC8uLykgIT09ICdmdW5jdGlvbicpIHtcclxuXHRpdHMuZnVuYyA9IGZ1bmN0aW9uKGV4cHJlc3Npb24pIHtcclxuXHRcdHJldHVybiBpdHMudHlwZS5hcHBseShudWxsLCBbdHlwZW9mIGV4cHJlc3Npb24gPT09IFwiZnVuY3Rpb25cIl0uY29uY2F0KHNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSkpO1xyXG5cdH07XHJcbn1cclxuXHJcbi8qKiBUaHJvd3MgYSBSZWZlcmVuY2VFcnJvciBpZiBhIGdpdmVuIGV4cHJlc3Npb24gaXMgZmFsc2VcclxuKlxyXG4qXHRAcGFyYW0ge0Jvb2xlYW59IGV4cHJlc3Npb24gVGhlIGRldGVybWluYW50IG9mIHdoZXRoZXIgYW4gZXhjZXB0aW9uIGlzIHRocm93blxyXG4qXHRAcGFyYW0ge1N0cmluZ30gW21lc3NhZ2VdIEEgbWVzc2FnZSBvciBtZXNzYWdlIHRlbXBsYXRlIGZvciB0aGUgZXJyb3IgKGlmIGl0IGdldHMgdGhyb3duKVxyXG4qXHRAcGFyYW0gey4uLk9iamVjdH0gW21lc3NhZ2VBcmdzXSBBcmd1bWVudHMgZm9yIGEgcHJvdmlkZWQgbWVzc2FnZSB0ZW1wbGF0ZVxyXG4qXHJcbipcdEByZXR1cm5zIHtPYmplY3R9IFJldHVybnMgdGhlIGV4cHJlc3Npb24gcGFzc2VkICBcclxuKlx0QHRocm93cyB7UmVmZXJlbmNlRXJyb3J9XHJcbipcclxuKlx0QGV4YW1wbGVcclxuKlx0XHRpdHMuZGVmaW5lZChcIlNvbWV0aGluZ1wiKTsgLy8gcmV0dXJucyB0cnVlXHJcbipcdFx0aXRzLmRlZmluZWQodm9pZCAwKTsgLy8gdGhyb3dzIFJlZmVyZW5jZUVycm9yIHdpdGggbm8gbWVzc2FnZVxyXG4qXHRcdGl0cy5kZWZpbmVkKHZvaWQgMCwgXCJTb21ldGhpbmcgd2VudCB3cm9uZyFcIik7IC8vIHRocm93cyBSZWZlcmVuY2VFcnJvciB3aXRoIG1lc3NhZ2U6IFwiU29tZXRoaW5nIHdlbnQgd3JvbmchXCJcclxuKlx0XHRpdHMuZGVmaW5lZCh2b2lkIDAsIFwiJXMgd2VudCAlcyFcIiwgXCJzb21ldGhpbmdcIiwgXCJ3cm9uZ1wiKTsgLy8gdGhyb3dzIFJlZmVyZW5jZUVycm9yIHdpdGggbWVzc2FnZTogXCJTb21ldGhpbmcgd2VudCB3cm9uZyFcIlxyXG4qL1xyXG5pdHMuZGVmaW5lZCA9IGZ1bmN0aW9uKGV4cHJlc3Npb24sIG1lc3NhZ2Upe1xyXG5cdGlmKGV4cHJlc3Npb24gPT09IHZvaWQgMCl7XHJcblx0XHR0aHJvdyBuZXcgUmVmZXJlbmNlRXJyb3IoYXJndW1lbnRzLmxlbmd0aCA+IDIgPyB0ZW1wbGF0ZWRNZXNzYWdlKG1lc3NhZ2UsIHNsaWNlLmNhbGwoYXJndW1lbnRzLDIpKSA6IG1lc3NhZ2UpO1xyXG5cdH1cclxuXHJcblx0cmV0dXJuIGV4cHJlc3Npb247XHJcbn07XHJcblxyXG4vKiogVGhyb3dzIGEgUmFuZ2VFcnJvciBpZiBhIGdpdmVuIGV4cHJlc3Npb24gaXMgZmFsc2VcclxuKlxyXG4qXHRAcGFyYW0ge0Jvb2xlYW59IGV4cHJlc3Npb24gVGhlIGRldGVybWluYW50IG9mIHdoZXRoZXIgYW4gZXhjZXB0aW9uIGlzIHRocm93blxyXG4qXHRAcGFyYW0ge1N0cmluZ30gW21lc3NhZ2VdIEEgbWVzc2FnZSBvciBtZXNzYWdlIHRlbXBsYXRlIGZvciB0aGUgZXJyb3IgKGlmIGl0IGdldHMgdGhyb3duKVxyXG4qXHRAcGFyYW0gey4uLk9iamVjdH0gW21lc3NhZ2VBcmdzXSBBcmd1bWVudHMgZm9yIGEgcHJvdmlkZWQgbWVzc2FnZSB0ZW1wbGF0ZVxyXG4qXHJcbipcdEByZXR1cm5zIHtCb29sZWFufSBSZXR1cm5zIHRoZSBleHByZXNzaW9uIHBhc3NlZCAgXHJcbipcdEB0aHJvd3Mge1JhbmdlRXJyb3J9XHJcbipcclxuKlx0QGV4YW1wbGVcclxuKlx0XHRpdHMucmFuZ2UoMSA+IDApOyAvLyByZXR1cm5zIHRydWVcclxuKlx0XHRpdHMucmFuZ2UoMSA8IDIpOyAvLyB0aHJvd3MgUmFuZ2VFcnJvciB3aXRoIG5vIG1lc3NhZ2VcclxuKlx0XHRpdHMucmFuZ2UoMSA8IDIgJiYgMSA+IDIsIFwiU29tZXRoaW5nIHdlbnQgd3JvbmchXCIpOyAvLyB0aHJvd3MgUmFuZ2VFcnJvciB3aXRoIG1lc3NhZ2U6IFwiU29tZXRoaW5nIHdlbnQgd3JvbmchXCJcclxuKlx0XHRpdHMucmFuZ2UoMSA8IDIgJiYgMSA+IDIsIFwiJXMgd2VudCAlcyFcIiwgXCJzb21ldGhpbmdcIiwgXCJ3cm9uZ1wiKTsgLy8gdGhyb3dzIFJhbmdlRXJyb3Igd2l0aCBtZXNzYWdlOiBcIlNvbWV0aGluZyB3ZW50IHdyb25nIVwiXHJcbiovXHJcbml0cy5yYW5nZSA9IGZ1bmN0aW9uKGV4cHJlc3Npb24sIG1lc3NhZ2Upe1xyXG5cdGlmKGV4cHJlc3Npb24gPT09IGZhbHNlKXtcclxuXHRcdHRocm93IG5ldyBSYW5nZUVycm9yKGFyZ3VtZW50cy5sZW5ndGggPiAyID8gdGVtcGxhdGVkTWVzc2FnZShtZXNzYWdlLCBzbGljZS5jYWxsKGFyZ3VtZW50cywyKSkgOiBtZXNzYWdlKTtcclxuXHR9XHJcblxyXG5cdHJldHVybiBleHByZXNzaW9uO1xyXG59OyJdfQ==