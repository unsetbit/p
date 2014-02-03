var Emitter = require('events').EventEmitter,
	ConnectionManager = require('./ConnectionManager.js'),
	WebSocketConnection = require('./WebSocketConnection.js'),
	WebRTCConnection = require('./WebRTCConnection.js'),
	its = require('its');

function P(emitter, connectionManager, options){
	its.defined(emitter);
	its.defined(connectionManager);

	this.emitter = emitter;
	this.peers = connectionManager;

	this.peers.onAdd = function(peer){
		emitter.emit('connection', peer);
	};

	this.peers.onRemove = function(peer){
		emitter.emit('disconnection', peer);
	};

	if(options && options.firewall) this.firewall = options.firewall;
}

P.create = function(options){
	var emitter = new Emitter(),
		connectionManager = new ConnectionManager();

	return new P(emitter, connectionManager, options);
};

P.prototype.getPeers = function(){
	return this.peers.get();
};

P.prototype.connect = function(address){
	its.string(address);

	var peers = this.peers,
		peer = WebSocketConnection.create(address, this.peers, {firewall: this.firewall});

	peers.add(peer);

	peer.on('close', function(){
		peers.remove(peer);
	});

	return peer;
};

P.prototype.on = function(){
	this.emitter.on.apply(this.emitter, arguments);
	return this;
};

P.prototype.removeListener = function(){
	this.emitter.removeListener.apply(this.emitter, arguments);
	return this;
};

module.exports = P;