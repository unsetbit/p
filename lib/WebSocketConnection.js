var its = require('its'),
	Connection = require('./Connection.js');

var WebSocketConnection = module.exports = function(emitter){
	Connection.call(this, emitter);
};
WebSocketConnection.prototype = Object.create(Connection.prototype);

WebSocketConnection.prototype.WebSocket = WebSocket;

WebSocketConnection.prototype.connect = function(address){
	var self = this;

	its.string(address);

	this.address = address;
	
	this.socket = new this.WebSocket(this.address, 'P');
	
	this.socket.onopen = this.openHandler.bind(this);
	this.socket.onclose = this.closeHandler.bind(this);
	this.socket.onerror = this.errorHandler.bind(this);
	
	this.socket.onmessage = function(event){
		self.messageHandler(event.data);
	};
};

WebSocketConnection.prototype.sendRaw = function(message){
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