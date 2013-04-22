var Emitter = require('emitter/index.js');
var protocol = require('./protocol.js');
var MESSAGE_TYPE = protocol.MESSAGE_TYPE;

Connection = module.exports = function(){
	Emitter.call(this);
	this.relayedConnections = {};
};
Connection.prototype = Object.create(Emitter.prototype);

Connection.prototype.getApi = function(){
	return {
		on: this.on.bind(this),
		removeListener: this.removeListener.bind(this),
		to: this.to.bind(this),
		send: this.send.bind(this),
		sendInternal: this.sendInternal.bind(this)
	};
};

Connection.prototype.to = function(remoteId, data){
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
		console.log("out");
		this.sendInternal(MESSAGE_TYPE.JSON, message);
	}
};

Connection.prototype.sendInternal = function(type){
	this.sendToSocket(JSON.stringify(Array.prototype.slice.call(arguments)));
};

Connection.prototype.messageHandler = function(event){
	if(event.data instanceof ArrayBuffer){
		this.emit("array buffer", event.data);
	} else if(typeof event.data === "string"){
		var message = JSON.parse(event.data);
		console.log("IN", message);
		switch(message[0]){
			case MESSAGE_TYPE.RELAYED:
				this.relayedMessageHandler(
					message[1], // remoteId
					message[2]  // message
				);
			break;

			case MESSAGE_TYPE.REMOTE_ADDRESS:
				this.remoteAddress(message[1]);
				break;

			case MESSAGE_TYPE.REMOTE_ADDRESSES:
				this.remoteAddresses(message[1]);
				break;

			case MESSAGE_TYPE.JSON:
				this.emit("json", message[1]);
				break;
		}
	}
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

Connection.prototype.remoteAddress = function(address){
	this.emit('remote address', address);
};

Connection.prototype.remoteAddresses = function(addresses){
	var index = 0,
		length = addresses.length;

	for(; index < length; index++){
		this.emit('remote address', addresses[index]);
	}
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

Connection.prototype.relay = function(remoteId, message){
	console.log("relaying", remoteId, message);
	this.sendInternal(MESSAGE_TYPE.RELAY, remoteId, message);
};

Connection.prototype.relayRtcOffer = function(remoteId, description, data){
	var self = this;
	console.log("relayed rtc offer", remoteId);
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
