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
