var protocol = require('./protocol.js'),
	MESSAGE_TYPE = protocol.MESSAGE_TYPE,
	PROTOCOL_NAME = protocol.NAME,
	Connection = require('./Connection.js'),
	RtcConnection;

var DEFAULT_CONFIGURATION = null,
	DEFAULT_CONSTRAINTS = {optional: [{RtpDataChannels: true}]},
	MEDIA_CONSTRAINTS = {
	    optional: [],
	    mandatory: {
	        OfferToReceiveAudio: false,
	        OfferToReceiveVideo: false
	    }
	};

RtcConnection = module.exports = function(connection, rtcConnection){
	this.connection = connection;
	connection.sendToSocket = this.sendToSocket.bind(this);
	connection.createRtcConnection = RtcConnection.create;

	this.rtcConnection = rtcConnection;
	this.rtcConnection.onicecandidate = this.iceCandidateHandler.bind(this);
	this.rtcConnection.oniceconnectionstatechange = this.iceConnectionStateChangeHandler.bind(this);

	this.socket = rtcConnection.createDataChannel(PROTOCOL_NAME, {reliable: false});
	this.socket.onmessage = this.connection.messageHandler.bind(this.connection);
	this.socket.onopen = this.openHandler.bind(this);
	this.socket.onclose = this.closeHandler.bind(this);
	this.socket.onerror = this.errorHandler.bind(this);
};

RtcConnection.create = function(relay, remoteId, options){
	options = options || {};

	var configuration = options.configuration || DEFAULT_CONFIGURATION,
		constraints = options.constraints || DEFAULT_CONSTRAINTS,
		rtcConnection = options.rtcConnection || new webkitRTCPeerConnection(configuration, constraints),
		connection = new Connection(relay.p),
		peerConnection = new RtcConnection(connection, rtcConnection);

	peerConnection.setRelay(relay, remoteId);

	return peerConnection;
};

RtcConnection.prototype.getApi = function(){
	var api = this.connection.getApi();
	api.close = this.close.bind(this);
	return api;
};

RtcConnection.prototype.close = function(){
	this.rtcConnection.close();
};

RtcConnection.prototype.sendToSocket = function(message){
	switch(this.socket.readyState){
		case 'connecting':
			throw new Error('Can\'t send a message while RTCDataChannel connecting');
		case 'open':
			this.socket.send(message);
			break;
		case 'closing':
		case 'closed':
			throw new Error('Can\'t send a message while RTCDataChannel is closing or closed');
	}
};

RtcConnection.prototype.iceConnectionStateChangeHandler = function(event){
	switch(event.currentTarget.iceConnectionState){
		case 'new': // gathering addresses and/or waiting for remote candidates to be supplied.
			break;
		case 'checking': // received remote candidates on at least one component, and is checking candidate pairs but has not yet found a connection. In addition to checking, it may also still be gathering.
			break;
		case 'connected': // found a usable connection for all components but is still checking other candidate pairs to see if there is a better connection. It may also still be gathering.
			break;
		case 'completed': // finished gathering and checking and found a connection for all components. Open issue: it is not clear how the non controlling ICE side knows it is in the state.
			break;
		case 'failed': // finished checking all candidate pairs and failed to find a connection for at least one component. Connections may have been found for some components.
			break;
		case 'disconnected': // liveness checks have failed for one or more components. This is more aggressive than failed, and may trigger intermittently (and resolve itself without action) on a flaky network.
			break;
		case 'closed': // shut down and is no longer responding to STUN requests.
			break;
	}
};

RtcConnection.prototype.errorHandler = function(event){
	this.connection.emit('error', event);
};

RtcConnection.prototype.openHandler = function(event){
	this.connection.emit('open');
};

RtcConnection.prototype.closeHandler = function(event){
	this.connection.emit('close');
};

RtcConnection.prototype.setRelay = function(relay, remoteId){
	if(this.relay) this.relay.relay(this, this.remoteId);
	
	this.relay = relay;
	this.remoteId = remoteId;
	this.relay.relayFor(this, remoteId);
};

RtcConnection.prototype.iceCandidateHandler = function(event){
	var candidate = event.candidate;
	if(candidate){
		this.relay.relay(this.remoteId,
			[
				MESSAGE_TYPE.RTC_ICE_CANDIDATE,
				candidate
			]
		);
	}
};

RtcConnection.prototype.createOffer = function(){
	var self = this;
	
	this.rtcConnection.createOffer(function(description){
		self.rtcConnection.setLocalDescription(description);
		self.relay.relay(self.remoteId,
			[
				MESSAGE_TYPE.RTC_OFFER,
				description
			]
		);
	}, null, MEDIA_CONSTRAINTS);
};

RtcConnection.prototype.createAnswer = function(remoteDescription){
	var self = this;

	this.rtcConnection.setRemoteDescription(new RTCSessionDescription(remoteDescription));
	this.rtcConnection.createAnswer(function(description){
		self.rtcConnection.setLocalDescription(description);
		self.relay.relay(self.remoteId,
			[
				MESSAGE_TYPE.RTC_ANSWER,
				description
			]
		);
	});
};

RtcConnection.prototype.receiveAnswer = function(description){
	this.rtcConnection.setRemoteDescription(new RTCSessionDescription(description));
};

RtcConnection.prototype.addIceCandidate = function(candidate){
	this.rtcConnection.addIceCandidate(new RTCIceCandidate(candidate));
};