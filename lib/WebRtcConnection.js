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

var log = function(){};

if(window.P_DEBUGGING_ENABLED){
	log = function(label, event, obj){
		window.console.debug(label, event, obj);		
	};
}

function WebRTCConnection(address, peers, rtcConnection, signalingChannel, options){
	var self = this;

	its.string(address);
	its.defined(peers);
	its.defined(rtcConnection);
	its.defined(signalingChannel);

	Connection.call(this, address, peers, options);

	this.signalingChannel = signalingChannel;
	this.rtcConnection = rtcConnection;
	this.rtcDataChannel = rtcConnection.createDataChannel(this.PROTOCOL_NAME, {protocol: this.PROTOCOL_NAME});


	// Bug in FF seems to garbage collect the stale ref causing it to close
	// the prevents it from being lost in a GC event
	this._initialRtcDataChannel = this.rtcDataChannel;
	

	this.close = rtcConnection.close.bind(rtcConnection);

	this.rtcConnection.addEventListener('icecandidate', function(event){
		if(!event.candidate) return;
		log('ice candidate', event, self);
		self.signalingChannel.writeRelayIceCandidate(address, event.candidate);
	});

	this.rtcConnection.addEventListener('datachannel', function(event){
		log('datachannel', event, self);

		var rtcDataChannel = self.rtcDataChannel = event.channel;
		rtcDataChannel.addEventListener('open', function(event){
			log('remote datachannel open', event, self);
			self.emitter.emit('open', event);
		});

		rtcDataChannel.addEventListener('close', function(event){
			log('remote datachannel close', event, self);
			self.emitter.emit('close', event);
		});

		rtcDataChannel.addEventListener('error', function(event){
			log('remote datachannel error', event, self);
			self.emitter.emit('error', event);
		});
	});

	this.rtcDataChannel.addEventListener('message', function(message){
		log('local datachannel message', message, self);
		self.readRaw(message.data);
	});

	this.rtcDataChannel.addEventListener('error', function(event){
		log('local datachannel error', event, self);
		self.emitter.emit('error', event);
	});

	this.rtcDataChannel.addEventListener('close', function(event){
		log('local datachannel close', event, self);
		self.emitter.emit('close', event);
	});
}

var DEFAULT_RTC_CONFIGURATION = null;
var DEFAULT_RTC_OFFER_OPTIONS = {
	offerToReceiveAudio: false,
	offerToReceiveVideo: false,
	iceRestart: false
};

//DEFAULT_RTC_OFFER_OPTIONS
WebRTCConnection.create = function(config, peers, signalingChannel, options){
	var rtcConfiguration = config.rtcConfiguration || DEFAULT_RTC_CONFIGURATION,
		rtcOfferOptions = config.rtcOfferOptions || DEFAULT_RTC_OFFER_OPTIONS,
		rtcConnection = new nativeRTCPeerConnection(rtcConfiguration);

	return new WebRTCConnection(config.address, peers, rtcConnection, signalingChannel, options);
};

WebRTCConnection.prototype = Object.create(Connection.prototype);

WebRTCConnection.prototype.writeRaw = function(message){
	switch(this.rtcDataChannel.readyState){
		case 'connecting':
			throw new Error('Can\'t send a message while RTCDataChannel connecting');
		case 'open':
			this.rtcDataChannel.send(message);
			log('sent message to remote', message, this);
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
	}, onError, config.rtcOfferOptions || DEFAULT_RTC_OFFER_OPTIONS);
};

WebRTCConnection.prototype.getReadyState = function(){
	return this.rtcDataChannel.readyState;
};

// Solves the circular dependency with Connection.js
Connection.createWebRTCConnection = WebRTCConnection.create;

module.exports = WebRTCConnection;