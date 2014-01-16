var JSONProtocol = require('./JSONProtocol.js'),
	its = require('its'),
	Emitter = require('events').EventEmitter;
	
function notImplemented(){
	throw new Error('This method is not implemented');
}

function Connection(address, peers, emitter){
	its.string(address);
	its.defined(peers);

	this.address = address;
	this.peers = peers;

	this.emitter = emitter || new Connection.Emitter();
	this.on = this.emitter.on.bind(this.emitter);
	this.removeListener = this.emitter.removeListener.bind(this.emitter);
}

// Circular dependency solved in WebRTCConnection.js
Connection.createWebRTCConnection = null;
Connection.Emitter = Emitter;

Connection.prototype = Object.create(JSONProtocol.prototype);

Connection.prototype.send = JSONProtocol.prototype.writeMessage;

Connection.prototype.getPeer = function(address){
	return this.peers.get(address);
};

Connection.prototype.addPeer = function(peer){
	return this.peers.add(peer);
};

Connection.prototype.getPeers = function() {
	return this.peers.get();
};

function isString(candidate){
	return Object.prototype.toString.call(candidate) === '[object String]';
}

Connection.prototype.connect = function(config){
	if(isString(config)){
		config = {address: config};
	}

	var self = this,
		peer = Connection.createWebRTCConnection(config, this.peers, this);
	
	peer.writeOffer(config);
	
	this.peers.add(peer);

	peer.on('close', function(){
		self.peers.remove(peer);
		self.emitter.emit('disconnection', peer);
	});

	this.emitter.emit('connection', peer);

	return peer;
};

Connection.prototype.readMessage = function(message){
	this.emitter.emit('message', message);
};

Connection.prototype.readArrayBuffer = function(message){
	this.emitter.emit('arraybuffer', message);
};

Connection.prototype.acceptRTCConnection = function(description, data){
	return true;
};

Connection.prototype.readRelay = function(peerAddress, message){
	var peer = this.getPeer(peerAddress);
	peer.writeRelayedMessage(this.address, message);
};

Connection.prototype.readRelayedIceCandidate = function(peerAddress, candidate){
	var peer = this.getPeer(peerAddress);
	peer.readIceCandidate(candidate);
};

Connection.prototype.readRelayedOffer = function(peerAddress, description, data){
	if(!this.acceptRTCConnection(description, data)) return false;

	var self = this,
		peer = Connection.createWebRTCConnection({address:peerAddress}, this.peers, this);
	
	this.addPeer(peer);

	peer.on('close', function(){
		self.peers.remove(peer);
		self.emitter.emit('disconnection', peer);
	});

	peer.readOffer(description, data);
	peer.writeAnswer();

	this.emitter.emit('connection', peer);
};

Connection.prototype.readRelayedAnswer = function(peerAddress, description){
	var peer = this.getPeer(peerAddress);
	peer.readAnswer(description);
};

Connection.prototype.close = notImplemented; // implemented higher up
Connection.prototype.getReadyState = notImplemented; // implemented higher up

Connection.prototype.isOpen = function(){
	return this.getReadyState() === 'open';
};

module.exports = Connection;
