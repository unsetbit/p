var Emitter = require('emitter/index.js'),
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
