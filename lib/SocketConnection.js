var RtcConnection = require('./RtcConnection.js');
var protocol = require('./protocol.js');
var MESSAGE_TYPE = protocol.MESSAGE_TYPE;
var PROTOCOL_NAME = protocol.NAME;
var DEFAULT_ADDRESS = "ws://127.0.0.1:20500/";
var Connection = require('./Connection.js');

var SocketConnection = module.exports = function(connection, socket){
	this.connection = connection;
	connection.sendToSocket = this.sendToSocket.bind(this);
	connection.createRtcConnection = RtcConnection.create;
	
	this.socket = socket;
	socket.onopen = this.openHandler.bind(this);
	socket.onclose = this.closeHandler.bind(this);
	socket.onerror = this.errorHandler.bind(this);
	socket.onmessage = this.connection.messageHandler.bind(this.connection);
};

SocketConnection.create = function(address){
	var socket = new WebSocket(address, PROTOCOL_NAME),
		connection = new Connection(),
		socketConnection = new SocketConnection(connection, socket);
	
	socket.binaryType = "arraybuffer";
	
	return socketConnection;
};

SocketConnection.prototype.getApi = function(){
	var api = this.connection.getApi();
	api.id = this.id;
	return api;
};

SocketConnection.prototype.sendToSocket = function(message){
	switch(this.socket.readyState){
		case WebSocket.CONNECTING:
			throw new Error("Can't send a message while WebSocket connecting");
			break;

		case WebSocket.OPEN:
			this.socket.send(message);
			break;

		case WebSocket.CLOSING:
		case WebSocket.CLOSED:
			throw new Error("Can't send a message while WebSocket is closing or closed");
			break;
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