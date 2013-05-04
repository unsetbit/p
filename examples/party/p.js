;P = (function(){
var __m7 = function(module,exports){module.exports=exports;

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  fn._off = on;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var i = callbacks.indexOf(fn._off || fn);
  if (~i) callbacks.splice(i, 1);
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

;return module.exports;}({},{});
var __m5 = function(module,exports){module.exports=exports;
//https://gist.github.com/LeverOne/1308368
exports.uuidV4 = function(a,b){for(b=a='';a++<36;b+=a*51&52?(a^15?8^Math.random()*(a^20?16:4):4).toString(16):'-');return b;};
;return module.exports;}({},{});
var __m3 = function(module,exports){module.exports=exports;
exports.NAME = "p";
exports.MESSAGE_TYPE = {
	PLAIN: 0, // [0, message]

	RTC_OFFER: 3, // [3, description, data]
	RTC_ANSWER: 4, // [4, description]
	RTC_ICE_CANDIDATE: 5, // [5, candidate]

	RELAY: 6, // [6, address, message]
	RELAYED: 7 // [7, address, message]
};

;return module.exports;}({},{});
var __m0 = function(module,exports){module.exports=exports;
var Emitter = __m7,
	protocol = __m3,
	uuidV4 = __m5.uuidV4,
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

;return module.exports;}({},{});
var __m6 = function(module,exports){module.exports=exports;
var protocol = __m3,
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	Connection = __m0,
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
;return module.exports;}({},{});
var __m2 = function(module,exports){module.exports=exports;
var RtcConnection = __m6,
	protocol = __m3,
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	DEFAULT_ADDRESS = "ws://127.0.0.1:20500/",
	Connection = __m0,
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
;return module.exports;}({},{});
var __m1 = function(module,exports){module.exports=exports;
var Emitter = __m7,
	protocol = __m3,
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	SocketConnection = __m2,
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
;return module.exports;}({},{});
var __m4 = function(module,exports){module.exports=exports;
window.P = __m1;

;return module.exports;}({},{});return __m1;}());