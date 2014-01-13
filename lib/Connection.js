var JSONProtocol = require('./JSONProtocol.js'),
	Emitter = require('events').EventEmitter;
	
function Connection(address, peers){
	this.address = address;
	this.peers = peers;

	this.emitter = new Emitter();
	this.on = this.emitter.on.bind(this.emitter);
	this.removeListener = this.emitter.removeListener.bind(this.emitter);
};

// Circular dependency solved in WebRTCConnection.js
Connection.createWebRTCConnection = null;

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

Connection.prototype.connect = function(address){
	var peers = this.peers,
		peer = Connection.createWebRTCConnection(address, this.peers, this);
	peer.writeOffer();
	
	peers.add(peer);

	peer.on('close', function(){
		peers.remove(peer);
	});

	return peer;
};

Connection.prototype.readMessage = function(message){
	this.emitter.emit('message', message);
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

	var peer = Connection.createWebRTCConnection(peerAddress, this.peers, this);
	this.addPeer(peer);

	peer.on('close', function(){
		this.peers.remove(peer);
	});

	peer.readOffer(description, data);
	peer.writeAnswer();

	this.emitter.emit('connection', peer);
};

Connection.prototype.readRelayedAnswer = function(peerAddress, description){
	var peer = this.getPeer(peerAddress);
	peer.readAnswer(description);
};

Connection.prototype.close = function(){}; // implemented higher up
Connection.prototype.getReadyState = function(){}; // implemented higher up

Connection.prototype.isOpen = function(){
	return this.getReadyState() === 'open';
};

module.exports = Connection;
