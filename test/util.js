var sinon = require('sinon');

exports.Connection = require('../lib/Connection.js');
exports.ConnectionManager = require('../lib/ConnectionManager.js');
exports.init = require('../lib/init.js');
exports.JSONProtocol = require('../lib/JSONProtocol.js');
exports.P = require('../lib/P.js');
exports.WebRTCConnection = require('../lib/WebRTCConnection.js');
exports.WebSocketConnection = require('../lib/WebSocketConnection.js');

exports.createMockEmitter = function(){
	return {
		on: sinon.spy(),
		removeListener: sinon.spy(),
		emit: sinon.spy()
	};
};

exports.createMockConnection = function(){
	var mock = exports.createMockEmitter();
	mock.writeRelayedMessage = sinon.spy();
	mock.readIceCandidate = sinon.spy();
	mock.writeRelayIceCandidate = sinon.spy();
	mock.writeOffer = sinon.spy();
	mock.readOffer = sinon.spy();
	mock.readAnswer = sinon.spy();
	mock.writeAnswer = sinon.spy();
	return mock;
};

exports.createMockConnectionManager = function(){
	var mockPeer = exports.createMockConnection();

	return {
		mockPeer: mockPeer,
		get: sinon.stub().returns(mockPeer),
		add: sinon.spy(),
		remove: sinon.spy(),
	};
};

exports.createMockRTCConnection = function(){
	var rtcDataChannel = exports.createMockRtcDataChannel();

	return {
		mockRTCDataChannel: rtcDataChannel,
		close: sinon.spy(),
		addEventListener: sinon.spy(),
		createDataChannel: sinon.stub().returns(rtcDataChannel)
	};
};

exports.createMockWebSocket = function(){
	return {
		close: sinon.spy(),
		addEventListener: sinon.spy(),
		send: sinon.spy()
	};
};

exports.createMockRtcDataChannel = function(){
	return {
		addEventListener: sinon.spy(),
		send: sinon.spy()
	};
};
