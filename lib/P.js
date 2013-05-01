var Emitter = require('emitter/index.js');
var uuidV4 = require('./utils.js').uuidV4;
var protocol = require('./protocol.js');
var MESSAGE_TYPE = protocol.MESSAGE_TYPE;
var PROTOCOL_NAME = protocol.NAME;
var SocketConnection = require('./SocketConnection.js');

var P = module.exports = function(emitter){
	this.emitter = emitter;

    this.connectionMap = {};
    this.connectionList = [];
};

P.create = function(options){
	options = options || {};
	var emitter = options.emitter || new Emitter(),
		anarch = new P(emitter);

	return anarch.getApi();
};

P.prototype.getApi = function(){
	var api = {};

	api.on = this.on.bind(this);
	api.removeListener = this.removeListener.bind(this);
	api.to = this.to.bind(this);

	Object.defineProperty(api, 'connections', {
		get: this.getConnections.bind(this)
	});

	return api;
};

P.prototype.getConnections = function(){
	return this.connectionList.slice(0);
};

P.prototype.to = function(address){
	var socketConnection = SocketConnection.create(this, address),
		api = socketConnection.getApi();

	api.on('open', this.connectionHandler.bind(this, api));
	return api;
};

P.prototype.on = function(){
	this.emitter.on.apply(this.emitter, arguments);
	return this;
};

P.prototype.removeListener = function(){
	this.emitter.removeListener.apply(this.emitter, arguments);
	return this;
};

P.prototype.connectionHandler = function(connection){
	var id = uuidV4();
    
    connection.id = id;
    connection.setId(id);
    connection.on('connection', this.connectionHandler.bind(this));
	connection.on('message', this.messageHandler.bind(this, connection));
    connection.on('close', this.connectionCloseHandler.bind(this, connection));
    
    this.connectionMap[id] = connection;
    this.connectionList.push(connection);
    
    this.emitter.emit("connection", connection);
};

P.prototype.messageHandler = function(origin, message){
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

P.prototype.relay = function(origin, destinationId, message){
	var destination = this.connectionMap[destinationId];
    if(!destination) return;
    
    destination.send([
        MESSAGE_TYPE.RELAYED,
        origin.id,
        message
    ]);
};

P.prototype.setRtcFirewall = function(func){
	this.rtcFirewall = func;
};

P.prototype.rtcFirewall = function(data, accept){
	accept();
};

P.prototype.rtcOffer = function(relaySocket, remoteId, description, data){
	var self = this;
	
	this.rtcFirewall(data, function(){
		var connection = RtcConnection.create(relaySocket, remoteId);
		connection.on('open', self.connectionHandler.bind(self, connection));
		connection.createAnswer(description);
	});
};

P.prototype.rtcAnswer = function(relaySocket, remoteId, description){
	var connection = relaySocket.getRelayedConnection(remoteId);
	if(!connection) return;

	connection.on('open', self.connectionHandler.bind(self, connection));
	connection.receiveAnswer(description);
};

P.prototype.rtcIceCandidate = function(relaySocket, remoteId, candidate){
	var connection = relaySocket.getRelayedConnection(remoteId);
	if(!connection) return;

	connection.addIceCandidate(candidate);
};

P.prototype.remoteAddress = function(relaySocket, remoteId){
	this.emitter.emit('remote address', remoteId);
};

P.prototype.remoteAddresses = function(relaySocket, remoteIds){
	var index = 0,
		length = remoteIds.length;

	for(; index < length; index++){
		this.emitter.emit('remote address', remoteIds[index]);
	}
};

P.prototype.connectionCloseHandler = function(connection){
    var index = this.connectionList.indexOf(connection);
    this.connectionList.splice(index, 1);
    delete this.connectionMap[connection.id];
};

P.prototype.broadcast = function(){
    var connections = this.connectionList,
        index = 0,
        length = connections.length;

    for(; index < length; index++){
        connections[index].send.apply(connections[index], arguments);
    }
};
