var RtcConnection = require('./RtcConnection.js'),
	protocol = require('./protocol.js'),
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	DEFAULT_ADDRESS = "ws://127.0.0.1:20500/",
	Connection = require('./Connection.js'),
	WebSocketConnection;

WebSocketConnection = module.exports = function(connection, socket){
	this.connection = connection;
	connection.sendToSocket = this.sendToSocket.bind(this);
	connection.createRtcConnection = RtcConnection.create;
	
	this.socket = socket;
	socket.onopen = this.openHandler.bind(this);
	socket.onclose = this.closeHandler.bind(this);
	socket.onerror = this.errorHandler.bind(this);
	socket.onmessage = this.connection.messageHandler.bind(this.connection);
};

WebSocketConnection.create = function(p, address){
	var socket = new WebSocket(address, PROTOCOL_NAME),
		connection = new Connection(p),
		webSocketConnection = new WebSocketConnection(connection, socket);
	
	socket.binaryType = "arraybuffer";
	
	return webSocketConnection;
};

WebSocketConnection.prototype.getApi = function(){
	var api = this.connection.getApi();
	api.close = this.close.bind(this);
	return api;
};

RtcConnection.prototype.close = function(){
	this.socket.close();
};

WebSocketConnection.prototype.sendToSocket = function(message){
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

WebSocketConnection.prototype.close = function(){
	this.socket.close();
};

WebSocketConnection.prototype.errorHandler = function(event){
	this.connection.emit('error', event);
};

WebSocketConnection.prototype.closeHandler = function(event){
	this.connection.emit('close');
};

WebSocketConnection.prototype.openHandler = function(event){
	this.connection.emit('open');
};