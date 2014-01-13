var Emitter = require('events').EventEmitter,
	ConnectionManager = require('./ConnectionManager.js'),
	WebSocketConnection = require('./WebSocketConnection.js'),
	WebRTCConnection = require('./WebRTCConnection.js');

function P(){
	var emitter = this.emitter = new Emitter();
	
	this.peers = new ConnectionManager();

	this.peers.onAdd = function(peer){
		emitter.emit('connection', peer);
	};

	this.peers.onRemove = function(peer){
		emitter.emit('disconnection', peer);
	};

	this.on = this.emitter.on.bind(this.emitter);
	this.removeListener = this.emitter.removeListener.bind(this.emitter);
};

P.prototype.connect = function(address){
	var peers = this.peers,
		peer = WebSocketConnection.create(address, this.peers);

	peers.add(peer);

	peer.on('close', function(){
		peers.remove(peer);
	});

	return peer;
};

module.exports = P;