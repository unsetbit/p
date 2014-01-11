var utils = require('./utils.js'),
	protocol = require('./protocol.js'),
	MESSAGE_TYPE = protocol.MESSAGE_TYPE;

var Connection = module.exports = function(emitter){
	this.id = utils.uuidV4();
	this.relayedConnections = {};
	this.emitter = emitter;
};

Connection.prototype.sendRaw = function(){
	throw new Error('Nothing is listening for messages sent from this connection.');
};

Connection.prototype.emit = function(){
	this.emitter.emit.apply(this.emitter, arguments);
};

Connection.prototype.log = function(){};

// Message is an array with the protocol specific parameters
Connection.prototype.sendProtocolMessage = function(message){
	var serializedMessage = JSON.stringify(message);
	this.sendRaw(serializedMessage);
};

// Sends direct message
Connection.prototype.send = function(){
	this.sendProtocolMessage([
		MESSAGE_TYPE.DIRECT,
		Array.prototype.slice.call(arguments)
	]);
};

// Relays a message from one connection to another, acting as
// a signalling channel.
Connection.prototype.sendRelayMessage = function(address, message){
	this.sendProtocolMessage([
		MESSAGE_TYPE.RELAY,
		address,
		message
	]);
};

Connection.prototype.startRelayingFor = function(socket, connectionId){
	this.relayedConnections[connectionId] = socket;
};

Connection.prototype.stopRelayingFor = function(socket, connectionId){
	delete this.relayedConnections[connectionId];
};

Connection.prototype.openHandler = function(){
	this.emit('open');
};

Connection.prototype.closeHandler = function(){
	this.emit('close');
};

Connection.prototype.errorHandler = function(data){
	this.emit('error', data);
};

Connection.prototype.messageHandler = function(message){
	var deserializedMessage;

	if(message instanceof ArrayBuffer){
		this.emit('message', message);
	} else {
		deserializedMessage = JSON.parse(message);
		this.protocolMessageHandler(deserializedMessage);
	}
};

Connection.prototype.protocolMessageHandler = function(message){
	var messageType = message[0];
	
	switch(messageType){

		// This is a message from the remote node to this one.
		case MESSAGE_TYPE.DIRECT:
			message[1].unshift('message');
			this.emit.apply(this, message[1]);

			break;

		// The message was relayed by the peer on behalf of
		// a third party peer, identified by "thirdPartyPeerId".
		// This means that the peer is acting as a signalling
		// channel on behalf of the third party peer.
		case MESSAGE_TYPE.RELAYED:
			this.relayedMessageHandler(
				message[1], // thirdPartyPeerConnectionId
				message[2]	// message
			);

			break;

		// The message is intended for another peer, identified
		// by "peerId", which is also connected to this node.
		// This means that the peer is using this connection
		// as a signalling channel in order to establish a connection
		// to the other peer identified "peerId".
		case MESSAGE_TYPE.RELAY:
			this.relayMessageHandler(
				message[1], // peerConnectionId
				message[2] 	// message
			);

			break;
	}
};

// "this" is the signaling channel, relaying a message from one node to another.
Connection.prototype.relayMessageHandler = function(connectionId, message){
	var connection = this.relayedConnections[connectionId];
	if(!connection) return;

	connection.sendProtocolMessage([
		MESSAGE_TYPE.RELAYED,
		this.id,
		message
	]);
};

Connection.prototype.relayedMessageHandler = function(thirdPartyId, message){
	var messageType = message[0];

	switch(messageType){
		// An initial connection request from a third party peer
		case MESSAGE_TYPE.RTC_OFFER:
			this.rtcOfferHandler(
				thirdPartyId,
				message[1],	// description
				message[2]	// data
			);

			break;
		
		// An answer to an RTC offer sent from this node
		case MESSAGE_TYPE.RTC_ANSWER:
			this.rtcAnswerHandler(
				thirdPartyId,
				message[1]	// description
			);
			
			break;
		
		// An ICE candidate from the source node
		case MESSAGE_TYPE.RTC_ICE_CANDIDATE:
			this.rtcIceCandidateHandler(
				thirdPartyId,
				message[1]	// ICE candidate
			);

			break;
	}
};

Connection.prototype.rtcOfferHandler = function(thirdPartyId, description, data){
	// We could be firewalling rtc offers according to information sent in data

	var connection = new P();
	
	connection.connect(thirdPartyId, this, true);
	this.emitter.emit('connection', connection);
	// Since we are accepting a connection, we create an answer to an offer
	connection.connection.receiveOffer(description);
	connection.connection.createAnswer();
};

Connection.prototype.rtcAnswerHandler = function(peerId, description){
	var connection = this.relayedConnections[peerId];
	if(!connection) return;

	connection.receiveAnswer(description);
};

Connection.prototype.rtcIceCandidateHandler = function(peerId, iceCandidate){
	var connection = this.relayedConnections[peerId];
	if(!connection) return;

	connection.addIceCandidate(iceCandidate);
};