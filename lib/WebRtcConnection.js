var Connection = require('./Connection.js');

var MEDIA_CONSTRAINTS = {
    optional: [],
    mandatory: {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
    }
};

var nativeRTCPeerConnection = RTCPeerConnection || webkitRTCPeerConnection || mozRTCPeerConnection;
var nativeRTCSessionDescription = RTCSessionDescription || mozRTCSessionDescription;
var nativeRTCIceCandidate = RTCIceCandidate || mozRTCIceCandidate;

function WebRTCConnection(address, peers, rtcConnection, signalingChannel){
	var self = this;

	Connection.call(this, address, peers)

	this.signalingChannel = signalingChannel;
	this.rtcConnection = rtcConnection;
	this.rtcDataChannel = rtcConnection.createDataChannel(this.PROTOCOL_NAME, {reliable: false});

	this.close = rtcConnection.close.bind(rtcConnection);

	this.rtcConnection.addEventListener('icecandidate', function(event){
		if(!event.candidate) return;

		self.signalingChannel.writeRelayIceCandidate(address, event.candidate);
	});

	this.rtcDataChannel.addEventListener('message', function(message){
		self.readRaw(message.data);
	});

	this.rtcDataChannel.addEventListener('open', function(event){
		self.emitter.emit('open', event)
	});

	this.rtcDataChannel.addEventListener('error', function(event){
		self.emitter.emit('error', event)
	});

	this.rtcDataChannel.addEventListener('close', function(event){
		self.emitter.emit('close', event)
	});
};

WebRTCConnection.create = function(address, peers, signalingChannel){
	var rtcConnection = new nativeRTCPeerConnection(null, {optional: [{RtpDataChannels: true}]});
	return new WebRTCConnection(address, peers, rtcConnection, signalingChannel);
};

WebRTCConnection.prototype = Object.create(Connection.prototype);

WebRTCConnection.prototype.writeRaw = function(message){
	switch(this.rtcDataChannel.readyState){
		case 'connecting':
			throw new Error('Can\'t send a message while RTCDataChannel connecting');
		case 'open':
			this.rtcDataChannel.send(message);
			break;
		case 'closing':
		case 'closed':
			throw new Error('Can\'t send a message while RTCDataChannel is closing or closed');
	}
};

WebRTCConnection.prototype.readAnswer = function(description){
	var rtcSessionDescription = new nativeRTCSessionDescription(description);
	this.rtcConnection.setRemoteDescription(rtcSessionDescription);
};

WebRTCConnection.prototype.readOffer = function(description, data){
	var rtcSessionDescription = new nativeRTCSessionDescription(description);
	this.rtcConnection.setRemoteDescription(rtcSessionDescription);
};

WebRTCConnection.prototype.readIceCandidate = function(candidate){
	this.rtcConnection.addIceCandidate(new nativeRTCIceCandidate(candidate));
};

WebRTCConnection.prototype.writeAnswer = function(){
	var address = this.address,
		rtcConnection = this.rtcConnection,
		signalingChannel = this.signalingChannel;

	rtcConnection.createAnswer(function(description){
		rtcConnection.setLocalDescription(description);
		signalingChannel.writeRelayAnswer(address, description);
	});
};

WebRTCConnection.prototype.writeOffer = function(){
	var address = this.address,
		rtcConnection = this.rtcConnection,
		signalingChannel = this.signalingChannel;

	rtcConnection.createOffer(function(description){
		rtcConnection.setLocalDescription(description);
		signalingChannel.writeRelayOffer(address, description);
	}, null, MEDIA_CONSTRAINTS);
};

WebRTCConnection.prototype.getReadyState = function(){
	return this.rtcDataChannel.readyState;
};


// Solves the circular dependency with Connection.js
Connection.createWebRTCConnection = WebRTCConnection.create;

module.exports = WebRTCConnection;