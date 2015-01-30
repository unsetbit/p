describe('WebRTCConnection', function(){
	var nativeRTCConnection,
		connectionManager,
		rtcConnection,
		rtcDataChannel,
		signalingChannel;

	beforeEach(function(){
		connectionManager = createMockConnectionManager();
		nativeRTCConnection = createMockRTCConnection();
		rtcDataChannel = nativeRTCConnection.mockRTCDataChannel;
		signalingChannel = createMockConnection();
		rtcConnection = new WebRTCConnection("123", connectionManager, nativeRTCConnection, signalingChannel);
	});

	it('throws an error when instantiated without required fields', function(){
		expect(function(){
			new WebRTCConnection();
		}).toThrow();

		// address not string
		expect(function(){
			new WebRTCConnection(123, {}, {}, {});
		}).toThrow();

		expect(function(){
			new WebRTCConnection(undefined, {}, {}, {});
		}).toThrow();

		expect(function(){
			new WebRTCConnection("123", undefined, {}, {});
		}).toThrow();

		expect(function(){
			new WebRTCConnection("123", {}, undefined, {});
		}).toThrow();

		expect(function(){
			new WebRTCConnection("123", {}, {}, undefined);
		}).toThrow();
	});

	it('throws an error if attempting to write to a non-open socket', function(){
		rtcConnection.rtcDataChannel = {readyState: 'closing'};
		expect(function(){rtcConnection.writeRaw("123");}).toThrow();
	});

	it('returns the rtcDataChannel ready state', function(){
		rtcConnection.rtcDataChannel = {readyState: 'closing'};
		expect(rtcConnection.getReadyState()).toBe('closing');
	});

	it('propogates data channel open, error, and close events', function(){
		rtcConnection.emitter = {emit: sinon.spy()};
		
		rtcConnection.emitter = {emit: sinon.spy()};
		rtcDataChannel.addEventListener.withArgs('error').firstCall.args[1]();
		expect(rtcConnection.emitter.emit.calledWith('error')).toBe(true);

		rtcConnection.emitter = {emit: sinon.spy()};
		rtcDataChannel.addEventListener.withArgs('close').firstCall.args[1]();
		expect(rtcConnection.emitter.emit.calledWith('close')).toBe(true);
	});

	it('passes data channel message through the protocol handler', function(){
		rtcConnection.readRaw = sinon.spy();
		rtcDataChannel.addEventListener.withArgs('message').firstCall.args[1]({data:123});
		expect(rtcConnection.readRaw.calledWith(123)).toBe(true);
	});

	it('relays ice candidates through signaling channel', function(){
		nativeRTCConnection.addEventListener.withArgs('icecandidate').firstCall.args[1]({candidate:123});
		expect(signalingChannel.writeRelayIceCandidate.calledWith("123", 123)).toBe(true);
	});

	it('contains all properties of Connection and JSONProtocol', function(){
		for(var property in JSONProtocol.prototype){
			if(JSONProtocol.prototype.hasOwnProperty(property)){
				expect(property in rtcConnection).toBe(true);
			}
		}
		

		for(property in Connection.prototype){
			if(Connection.prototype.hasOwnProperty(property)){
				expect(property in rtcConnection).toBe(true);
			}
		}
	});
});