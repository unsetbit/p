window.Connection = require('../lib/Connection.js');
window.ConnectionManager = require('../lib/ConnectionManager.js');
window.init = require('../lib/init.js');
window.JSONProtocol = require('../lib/JSONProtocol.js');
window.P = require('../lib/P.js');
window.WebRTCConnection = require('../lib/WebRTCConnection.js');
window.WebSocketConnection = require('../lib/WebSocketConnection.js');

window.createMockEmitter = function(){
	return {
		on: sinon.spy(),
		removeListener: sinon.spy(),
		emit: sinon.spy()
	};
};

window.createMockConnection = function(){
	var mock = createMockEmitter();
	mock.writeRelayedMessage = sinon.spy();
	mock.readIceCandidate = sinon.spy();
	mock.writeRelayIceCandidate = sinon.spy();
	mock.writeOffer = sinon.spy();
	mock.readOffer = sinon.spy();
	mock.readAnswer = sinon.spy();
	mock.writeAnswer = sinon.spy();
	return mock;
};

window.createMockConnectionManager = function(){
	var mockPeer = createMockConnection();
	
	return {
		mockPeer: mockPeer,
		get: sinon.stub().returns(mockPeer),
		add: sinon.spy(),
		remove: sinon.spy(),
	};
};

window.createMockRTCConnection = function(){
	var rtcDataChannel = createMockRtcDataChannel();

	return {
		mockRTCDataChannel: rtcDataChannel,
		close: sinon.spy(),
		addEventListener: sinon.spy(),
		createDataChannel: sinon.stub().returns(rtcDataChannel)
	};
};

window.createMockWebSocket = function(){
	return {
		close: sinon.spy(),
		addEventListener: sinon.spy(),
		send: sinon.spy()
	};
};

window.createMockRtcDataChannel = function(){
	return {
		addEventListener: sinon.spy(),
		send: sinon.spy()
	}
};
