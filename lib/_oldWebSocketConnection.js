var RtcConnection = require('./RtcConnection.js'),
	protocol = require('./protocol.js'),
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	DEFAULT_ADDRESS = "ws://127.0.0.1:20500/",
	Connection = require('./Connection.js'),
	its = require('its'),
	WebSocketConnection;

WebSocketConnection = module.exports = function(connection, webSocket){
	its.defined(connection);
	its.defined(webSocket);

	this.connection = connection;
	connection.sendToSocket = this.sendToSocket.bind(this);
	connection.createRtcConnection = RtcConnection.create;
	
	this.webSocket = webSocket;
	webSocket.onopen = this.openHandler.bind(this);
	webSocket.onclose = this.closeHandler.bind(this);
	webSocket.onerror = this.errorHandler.bind(this);
	webSocket.onmessage = this.connection.messageHandler.bind(this.connection);
};

WebSocketConnection.create = function(p, address){
	var webSocket = new WebSocket(address, PROTOCOL_NAME),
		connection = new Connection(p),
		webSocketConnection = new WebSocketConnection(connection, webSocket);
	
	webSocket.binaryType = "arraybuffer";
	
	return webSocketConnection;
};

WebSocketConnection.prototype.getApi = function(){
	var api = this.connection.getApi();
	api.close = this.close.bind(this);
	return api;
};

WebSocketConnection.prototype.close = function(){
	this.webSocket.close();
};

WebSocketConnection.prototype.sendToSocket = function(message){
	switch(this.webSocket.readyState){
		case WebSocket.CONNECTING:
			throw new Error("Can't send a message while WebSocket connecting");

		case WebSocket.OPEN:
			this.webSocket.send(message);
			break;

		case WebSocket.CLOSING:
		case WebSocket.CLOSED:
			throw new Error("Can't send a message while WebSocket is closing or closed");
	}

	return this;
};

WebSocketConnection.prototype.close = function(){
	this.webSocket.close();
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