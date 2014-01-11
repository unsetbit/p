var its = require('its');
var Emitter = require('events').EventEmitter;
var WebSocketConnection = require('./WebSocketConnection.js');
var WebRtcConnection = require('./WebRtcConnection.js');
var Connection = require('./Connection.js');

var P = module.exports = function(emitter){
	this.emitter = emitter || new Emitter();
};

P.WebSocketConnection = WebSocketConnection;
P.WebRtcConnection = WebRtcConnection;
P.Connection = Connection;

P.prototype.log = function(){};

P.prototype.connect = function(address, signalingChannel, bad){
	its.defined(address);
	this.address = address;

	var connection;

	if(signalingChannel){
		connection = new WebRtcConnection(this.emitter);
		connection.connect(address, signalingChannel.connection || signalingChannel);
		if(!bad) connection.createOffer();
	} else {
		connection = new WebSocketConnection(this.emitter);
		connection.connect(address);
	}

	this.connection = connection;
};

P.prototype.on = function(){
	this.emitter.on.apply(this.emitter, arguments);
	return this;
};

P.prototype.removeListener = function(){
	this.emitter.removeListener.apply(this.emitter, arguments);
	return this;
};

P.prototype.send = function(message){
	if(message instanceof ArrayBuffer){
		this.connection.sendRaw(message);
	} else {
		this.connection.send.apply(this.connection, arguments);
	}
};