var its = require('its'),
	Emitter = require('events').EventEmitter,
	protocol = require('./protocol.js'),
	Connection = require('./Connection.js'),
	MESSAGE_TYPE = protocol.MESSAGE_TYPE;
	
var WebRtcConnection = module.exports = function(emitter){
	Connection.call(this, emitter);
};
WebRtcConnection.prototype = Object.create(Connection.prototype)

WebRtcConnection.prototype.configuration = null;

WebRtcConnection.prototype.constraints = {
	optional: [{RtpDataChannels: true}]
};

WebRtcConnection.prototype.mediaConstraints = {
    optional: [],
    mandatory: {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
    }
};

WebRtcConnection.prototype.RtcPeerConnection = webkitRTCPeerConnection;

WebRtcConnection.prototype.connect = function(id, signalingSocket){
	var self = this;

	its.string(id);
	its.defined(signalingSocket);

	this.id = id;
	this.signalingSocket = signalingSocket;

	this.signalingSocket.startRelayingFor(this, id);

	this.peerConnection = new this.RtcPeerConnection(this.configuration, this.constraints);
	this.peerConnection.onicecandidate = this.iceCandidateHandler.bind(this);
	this.peerConnection.oniceconnectionstatechange = this.iceConnectionStateChangeHandler.bind(this);

	this.socket = this.peerConnection.createDataChannel(protocol.NAME, {reliable: false});
	
	this.socket.onopen = this.openHandler.bind(this);
	this.socket.onerror = this.errorHandler.bind(this);
	
	this.socket.onclose = function(){
		self.signalingSocket.stopRelayingFor(this, id);
		self.closeHandler();
	};
	
	this.socket.onmessage = function(event){
		self.messageHandler(event.data);
	};
};

WebRtcConnection.prototype.sendRaw = function(message){
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

	return this;
};

WebRtcConnection.prototype.iceConnectionStateChangeHandler = function(event){
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

WebRtcConnection.prototype.iceCandidateHandler = function(event){
	var candidate = event.candidate;
	if(candidate){
		this.signalingSocket.sendRelayMessage(this.id, [
			MESSAGE_TYPE.RTC_ICE_CANDIDATE,
			candidate
		]);
	}
};

WebRtcConnection.prototype.addIceCandidate = function(candidate){
	this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
};

WebRtcConnection.prototype.createOffer = function(){
	var peerConnection = this.peerConnection,
		signalingSocket = this.signalingSocket,
		id = this.id;
	
	peerConnection.createOffer(function(description){
		peerConnection.setLocalDescription(description);
		signalingSocket.sendRelayMessage(id, [
			MESSAGE_TYPE.RTC_OFFER,
			description
		]);
	}, null, this.mediaConstraints);
};

WebRtcConnection.prototype.receiveOffer = function(remoteDescription){
	var rtcSessionDescription = new RTCSessionDescription(remoteDescription);
	this.peerConnection.setRemoteDescription(rtcSessionDescription);
};

WebRtcConnection.prototype.createAnswer = function(){
	var peerConnection = this.peerConnection,
		signalingSocket = this.signalingSocket,
		id = this.id;
		
	peerConnection.createAnswer(function(description){
		peerConnection.setLocalDescription(description);
		
		signalingSocket.sendRelayMessage(id, [
			MESSAGE_TYPE.RTC_ANSWER,
			description
		]);
	});
};

WebRtcConnection.prototype.receiveAnswer = function(description){
	var rtcSessionDescription = new RTCSessionDescription(description);
	this.peerConnection.setRemoteDescription(rtcSessionDescription);
};

WebRtcConnection.prototype.close = function(){
	this.socket.close();
};