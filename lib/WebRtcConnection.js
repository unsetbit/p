var Connection = require('./Connection.js'),
	its = require('its');

var nativeRTCPeerConnection = (typeof RTCPeerConnection !== 'undefined')? RTCPeerConnection :
							  (typeof webkitRTCPeerConnection !== 'undefined')? webkitRTCPeerConnection :
							  (typeof mozRTCPeerConnection !== 'undefined')? mozRTCPeerConnection :
							  undefined;

var nativeRTCSessionDescription = (typeof RTCSessionDescription !== 'undefined')? RTCSessionDescription :
								  (typeof mozRTCSessionDescription !== 'undefined')? mozRTCSessionDescription :
								  undefined;
var nativeRTCIceCandidate = (typeof RTCIceCandidate !== 'undefined')? RTCIceCandidate :
							(typeof mozRTCIceCandidate !== 'undefined')? mozRTCIceCandidate :
							undefined;

function WebRTCConnection(address, peers, rtcConnection, signalingChannel, options){
	var self = this;

	its.string(address);
	its.defined(peers);
	its.defined(rtcConnection);
	its.defined(signalingChannel);

	Connection.call(this, address, peers, options);

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
		self.emitter.emit('open', event);
	});

	this.rtcDataChannel.addEventListener('error', function(event){
		self.emitter.emit('error', event);
	});

	this.rtcDataChannel.addEventListener('close', function(event){
		self.emitter.emit('close', event);
	});
}

var DEFAULT_RTC_CONFIGURATION = null;
var DEFAULT_MEDIA_CONSTRAINTS = {
	optional: [{RtpDataChannels: true}],
    mandatory: {
        OfferToReceiveAudio: false,
        OfferToReceiveVideo: false
    }
};

WebRTCConnection.create = function(config, peers, signalingChannel, options){
	var rtcConfiguration = config.rtcConfiguration || DEFAULT_RTC_CONFIGURATION,
		mediaConstraints = config.mediaConstraints || DEFAULT_MEDIA_CONSTRAINTS,
		rtcConnection = new nativeRTCPeerConnection(rtcConfiguration, mediaConstraints);

	return new WebRTCConnection(config.address, peers, rtcConnection, signalingChannel, options);
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

WebRTCConnection.prototype.readOffer = function(description){
	var rtcSessionDescription = new nativeRTCSessionDescription(description);
	
	this.rtcConnection.setRemoteDescription(rtcSessionDescription);
};

WebRTCConnection.prototype.readIceCandidate = function(candidate){
	var emitter = this.emitter;
	this.rtcConnection.addIceCandidate(new nativeRTCIceCandidate(candidate));
};

WebRTCConnection.prototype.writeAnswer = function(){
	var emitter = this.emitter,
		address = this.address,
		rtcConnection = this.rtcConnection,
		signalingChannel = this.signalingChannel;

	function onError(err){ emitter.emit('error', err); }

	rtcConnection.createAnswer(function(description){
		rtcConnection.setLocalDescription(description, function(){
			signalingChannel.writeRelayAnswer(address, description);
		}, onError);
	}, onError);
};

WebRTCConnection.prototype.writeOffer = function(config){
	var emitter = this.emitter,
		address = this.address,
		rtcConnection = this.rtcConnection,
		signalingChannel = this.signalingChannel;

	function onError(err){ emitter.emit('error', err); }

	rtcConnection.createOffer(function(description){
		rtcConnection.setLocalDescription(description, function(){
			signalingChannel.writeRelayOffer(address, description, config.offerData);
		}, onError);
	}, onError, config.mediaConstraints || DEFAULT_MEDIA_CONSTRAINTS);
};

WebRTCConnection.prototype.getReadyState = function(){
	return this.rtcDataChannel.readyState;
};


// Solves the circular dependency with Connection.js
Connection.createWebRTCConnection = WebRTCConnection.create;

module.exports = WebRTCConnection;