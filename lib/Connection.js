var JSONProtocol = require('./JSONProtocol.js'),
	its = require('its'),
	Emitter = require('events').EventEmitter;
	
function notImplemented(){
	throw new Error('This method is not implemented');
}

function Connection(address, peers, options){
	its.string(address);
	its.defined(peers);

	this.address = address;
	this.peers = peers;

	if(options){
		if(options.emitter) this.emitter = options.emitter;
		if(options.firewall) this.acceptRTCConnection = options.firewall;
	}

	if(!this.emitter) this.emitter = new Connection.Emitter();
}

// Circular dependency solved in WebRTCConnection.js
Connection.createWebRTCConnection = null;
Connection.Emitter = Emitter;

Connection.prototype = Object.create(JSONProtocol.prototype);

Connection.prototype.on = function(){
	this.emitter.on.apply(this.emitter, arguments);
	return this;
};

Connection.prototype.removeListener = function(){
	this.emitter.removeListener.apply(this.emitter, arguments);
	return this;
};

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
		firewall = config.firewall || this.firewall,
		peer = Connection.createWebRTCConnection(config, this.peers, this, {firewall: firewall});
	
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

	if(!peer){
		this.emitter.emit('error', new Error("Unknown peer at address: " + peerAddress));
		return;
	}
	
	peer.writeRelayedMessage(this.address, message);
};

Connection.prototype.readRelayedIceCandidate = function(peerAddress, candidate){
	var peer = this.getPeer(peerAddress);

	if(!peer){
		this.emitter.emit('error', new Error("Unknown peer at address: " + peerAddress));
		return;
	}

	peer.readIceCandidate(candidate);
};

Connection.prototype.readRelayedOffer = function(peerAddress, description, data){
	if(!this.acceptRTCConnection(description, data)) return false;

	var self = this,
		peer = Connection.createWebRTCConnection({address:peerAddress}, this.peers, this, {firewall: this.firewall});
	
	this.addPeer(peer);

	peer.on('close', function(){
		self.peers.remove(peer);
		self.emitter.emit('disconnection', peer);
	});

	peer.readOffer(description);
	peer.writeAnswer();

	this.emitter.emit('connection', peer);
};

Connection.prototype.readRelayedAnswer = function(peerAddress, description){
	var peer = this.getPeer(peerAddress);

	if(!peer){
		this.emitter.emit('error', new Error("Unknown peer at address: " + peerAddress));
		return;
	}

	peer.readAnswer(description);
};

Connection.prototype.close = notImplemented; // implemented higher up
Connection.prototype.getReadyState = notImplemented; // implemented higher up

Connection.prototype.isOpen = function(){
	return this.getReadyState() === 'open';
};

module.exports = Connection;
