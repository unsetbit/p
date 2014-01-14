function notImplemented(){
	throw new Error('This method is not implemented');
}

function JSONProtocol(){}

JSONProtocol.prototype.PROTOCOL_NAME = 'p';

JSONProtocol.prototype.MESSAGE_TYPE = {
	DIRECT: 0, // [0, message]

	RTC_OFFER: 3, // [3, description, data]
	RTC_ANSWER: 4, // [4, description]
	RTC_ICE_CANDIDATE: 5, // [5, candidate]

	RELAY: 6, // [6, address, message]
	RELAYED: 7 // [7, address, message]
};

JSONProtocol.prototype.readRaw = function(message){
	if(message instanceof ArrayBuffer){
		this.readArrayBuffer(message);
	} else {
		this.readProtocolMessage(JSON.parse(message));
	}	
};

JSONProtocol.prototype.readProtocolMessage = function(message){
	var MESSAGE_TYPE = this.MESSAGE_TYPE,
		messageType = message[0];
	
	switch(messageType){
		// This is a message from the remote node to this one.
		case MESSAGE_TYPE.DIRECT:
			this.readMessage(message[1]);
			break;

		// The message was relayed by the peer on behalf of
		// a third party peer, identified by "thirdPartyPeerId".
		// This means that the peer is acting as a signalling
		// channel on behalf of the third party peer.
		case MESSAGE_TYPE.RELAYED:
			this.readRelayedMessage(message[1], message[2]);
			break;

		// The message is intended for another peer, identified
		// by "peerId", which is also connected to this node.
		// This means that the peer is using this connection
		// as a signalling channel in order to establish a connection
		// to the other peer identified "peerId".
		case MESSAGE_TYPE.RELAY:
			this.readRelay(message[1], message[2]);
			break;

		default:
			throw new Error('Unknown message type: ' + messageType);
	}
};

JSONProtocol.prototype.readRelayedMessage = function(origin, message){
	var MESSAGE_TYPE = this.MESSAGE_TYPE,
		messageType = message[0];

	switch(messageType){
		// An initial connection request from a third party peer
		case MESSAGE_TYPE.RTC_OFFER:
			this.readRelayedOffer(origin, message[1], message[2]);
			break;
		
		// An answer to an RTC offer sent from this node
		case MESSAGE_TYPE.RTC_ANSWER:
			this.readRelayedAnswer(origin, message[1]);
			break;
		
		// An ICE candidate from the source node
		case MESSAGE_TYPE.RTC_ICE_CANDIDATE:
			this.readRelayedIceCandidate(origin, message[1]);
			break;

		default:
			throw new Error('Unknown message type: ' + messageType);
	}		
};

JSONProtocol.prototype.readMessage = notImplemented;
JSONProtocol.prototype.readArrayBuffer = notImplemented;
JSONProtocol.prototype.readRelay = notImplemented;

JSONProtocol.prototype.readRelayedOffer = notImplemented;
JSONProtocol.prototype.readRelayedAnswer = notImplemented;
JSONProtocol.prototype.readRelayedIceCandidate = notImplemented;

JSONProtocol.prototype.writeRaw = notImplemented;

JSONProtocol.prototype.writeProtocolMessage = function(message){
	var serializedMessage = JSON.stringify(message);
	this.writeRaw(serializedMessage);
};

JSONProtocol.prototype.writeMessage = function(message){
	if(message instanceof ArrayBuffer){
		this.writeRaw(message);
	} else {
		this.writeStringMessage(message);
	}
};

JSONProtocol.prototype.writeStringMessage = function(message){
	this.writeProtocolMessage([
		this.MESSAGE_TYPE.DIRECT,
		message
	]);
};

JSONProtocol.prototype.writeRelayedMessage = function(origin, message){
	this.writeProtocolMessage([
		this.MESSAGE_TYPE.RELAYED,
		origin,
		message
	]);
};

JSONProtocol.prototype.writeRelayMessage = function(destination, message){
	this.writeProtocolMessage([
		this.MESSAGE_TYPE.RELAY,
		destination,
		message
	]);
};

JSONProtocol.prototype.writeRelayAnswer = function(destination, description){
	this.writeRelayMessage(destination, [
		this.MESSAGE_TYPE.RTC_ANSWER,
		description
	]);
};

JSONProtocol.prototype.writeRelayIceCandidate = function(destination, candidate){
	this.writeRelayMessage(destination, [
		this.MESSAGE_TYPE.RTC_ICE_CANDIDATE,
		candidate
	]);
};

JSONProtocol.prototype.writeRelayOffer = function(destination, description, data){
	this.writeRelayMessage(destination, [
		this.MESSAGE_TYPE.RTC_OFFER,
		description,
		data
	]);
};

module.exports = JSONProtocol;