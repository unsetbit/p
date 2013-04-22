var Emitter = require('emitter/index.js');
var uuidV4 = require('./utils.js').uuidV4;
var protocol = require('./protocol.js');
var MESSAGE_TYPE = protocol.MESSAGE_TYPE;
var PROTOCOL_NAME = protocol.NAME;
var SocketConnection = require('./SocketConnection.js');

var Anarch = module.exports = function(emitter){
	this.emitter = emitter;

    this.connectionMap = {};
    this.connectionList = [];
};

Anarch.create = function(options){
	options = options || {};
	var emitter = options.emitter || new Emitter(),
		anarch = new Anarch(emitter);

	return anarch.getApi();
};

Anarch.prototype.getApi = function(){
	return {
		on: this.on.bind(this),
		removeListener: this.removeListener.bind(this),
		to: this.to.bind(this),
		getConnections: this.getConnections.bind(this)
	}
};

Anarch.prototype.getConnections = function(){
	return this.connectionList.slice(0);
};

Anarch.prototype.to = function(address){
	var socketConnection = SocketConnection.create(address),
		api = socketConnection.getApi();

	api.on('open', this.connectionHandler.bind(this, api));
	return api;
};

Anarch.prototype.on = function(){
	this.emitter.on.apply(this.emitter, arguments);
	return this;
};

Anarch.prototype.removeListener = function(){
	this.emitter.removeListener.apply(this.emitter, arguments);
	return this;
};

Anarch.prototype.connectionHandler = function(connection){
	var id = uuidV4();
    
    connection.on('connection', this.connectionHandler.bind(this));
	connection.on('message', this.messageHandler.bind(this, connection));
    connection.on('close', this.connectionCloseHandler.bind(this, connection));

    connection.sendInternal(
    	MESSAGE_TYPE.REMOTE_ADDRESSES,
        Object.keys(this.connectionMap)
    );

    this.connectionMap[id] = connection;
    this.connectionList.push(connection);
};

Anarch.prototype.messageHandler = function(origin, message){
    switch(message[0]){
        case MESSAGE_TYPE.RELAY:
            this.relay(
                origin, 
                message[1], // destinationId
                message[2]  // message
            );
        break;
    }
};

Anarch.prototype.relay = function(origin, destinationId, message){
    var destination = this.connectionMap[destinationId];
    if(!destination) return;
    
    destination.send([
        MESSAGE_TYPE.RELAYED,
        origin.id,
        message
    ]);
};

Anarch.prototype.setRtcFirewall = function(func){
	this.rtcFirewall = func;
};

Anarch.prototype.rtcFirewall = function(data, accept){
	accept();
};

Anarch.prototype.rtcOffer = function(relaySocket, remoteId, description, data){
	var self = this;
	
	this.rtcFirewall(data, function(){
		var connection = RtcConnection.create(relaySocket, remoteId);
		connection.on('open', self.connectionHandler.bind(self, connection));
		connection.createAnswer(description);
	});
};

Anarch.prototype.rtcAnswer = function(relaySocket, remoteId, description){
	var connection = relaySocket.getRelayedConnection(remoteId);
	if(!connection) return;

	connection.on('open', self.connectionHandler.bind(self, connection));
	connection.receiveAnswer(description);
};

Anarch.prototype.rtcIceCandidate = function(relaySocket, remoteId, candidate){
	var connection = relaySocket.getRelayedConnection(remoteId);
	if(!connection) return;

	connection.addIceCandidate(candidate);
};

Anarch.prototype.remoteAddress = function(relaySocket, remoteId){
	this.emitter.emit('remote address', remoteId);
};

Anarch.prototype.remoteAddresses = function(relaySocket, remoteIds){
	var index = 0,
		length = remoteIds.length;

	for(; index < length; index++){
		console.log("REMOTE ADDRESS", remoteIds[index]);
		this.emitter.emit('remote address', remoteIds[index]);
	}
};

Anarch.prototype.connectionCloseHandler = function(connection){
    var index = this.connectionList.indexOf(connection);
    this.connectionList.splice(index, 1);
    delete this.connectionMap[connection.id];
};

Anarch.prototype.broadcast = function(message){
    var connections = this.connectionList,
        index = 0,
        length = connections.length;

    for(; index < length; index++){
        connections[index].send(message);
    }
};
