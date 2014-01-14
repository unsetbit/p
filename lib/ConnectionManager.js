var its = require('its');

function noop(){}

function ConnectionManager(){
	this.connectionMap = {};
	this.connectionList = [];
}

ConnectionManager.prototype.get = function(address){
	if(address === undefined) return this.connectionList.slice();

	return this.connectionMap[address];
};

ConnectionManager.prototype.add = function(connection) {
	its.defined(connection);

	var address = connection.address;
	its.string(address);

	if(address in this.connectionMap) return false;
	
	this.connectionMap[address] = connection;
	this.connectionList.push(connection);

	this.onAdd(connection);
	return true;
};
ConnectionManager.prototype.onAdd = noop;

ConnectionManager.prototype.remove = function(connection){
	its.defined(connection);

	var address = connection.address;
	its.string(address);

	var mappedConnection = this.connectionMap[address];
	if(!mappedConnection || mappedConnection !== connection) return false;

	delete this.connectionMap[address];
	
	var index = this.connectionList.indexOf(connection);
	this.connectionList.splice(index, 1);

	this.onRemove(connection);
	return true;
};
ConnectionManager.prototype.onRemove = noop;

module.exports = ConnectionManager;