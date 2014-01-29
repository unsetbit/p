var Connection = require('./Connection.js');

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
		case WebSocket.CONNECTING:
			throw new Error("Can't send a message while WebSocket connecting");

		case WebSocket.OPEN:
			this.webSocket.send(message);
			break;

		case WebSocket.CLOSING:
		case WebSocket.CLOSED:
			throw new Error("Can't send a message while WebSocket is closing or closed");
	}
};

WebSocketConnection.prototype.getReadyState = function(){
	switch(this.webSocket.readyState){
		case WebSocket.CONNECTING:
			return 'connecting';
		case WebSocket.OPEN:
			return 'open';
		case WebSocket.CLOSING:
			return 'closing';
		case WebSocket.CLOSED:
			return 'closed';
	}
};

module.exports = WebSocketConnection;