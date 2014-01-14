describe('WebSocketConnection', function(){
	var nativeWebSocket,
		connectionManager,
		connection,
		signalingChannel;

	beforeEach(function(){
		connectionManager = createMockConnectionManager();
		nativeWebSocket = createMockWebSocket();
		signalingChannel = createMockConnection();
		connection = new WebSocketConnection("123", connectionManager, nativeWebSocket);
	});

	it('throws an error when instantiated without required fields', function(){
		expect(function(){
			new WebSocketConnection();
		}).toThrow();

		// address not string
		expect(function(){
			new WebSocketConnection(123, {}, {});
		}).toThrow();

		expect(function(){
			new WebSocketConnection(undefined, {}, {});
		}).toThrow();

		expect(function(){
			new WebSocketConnection("123", undefined, {});
		}).toThrow();

		expect(function(){
			new WebSocketConnection("123", {}, undefined);
		}).toThrow();
	});

	it('throws an error if attempting to write to a non-open socket', function(){
		connection.webSocket.readyState = WebSocket.CLOSED;
		expect(function(){connection.writeRaw("123");}).toThrow();
	});

	it('returns the websocket ready state as webrtc-like ready state', function(){
		connection.webSocket.readyState = WebSocket.CLOSING;
		expect(connection.getReadyState()).toBe('closing');
	});

	it('propogates websocket open, error, and close events', function(){
		connection.emitter = {emit: sinon.spy()};
		nativeWebSocket.addEventListener.withArgs('open').firstCall.args[1]();
		expect(connection.emitter.emit.calledWith('open')).toBe(true);

		connection.emitter = {emit: sinon.spy()};
		nativeWebSocket.addEventListener.withArgs('error').firstCall.args[1]();
		expect(connection.emitter.emit.calledWith('error')).toBe(true);

		connection.emitter = {emit: sinon.spy()};
		nativeWebSocket.addEventListener.withArgs('close').firstCall.args[1]();
		expect(connection.emitter.emit.calledWith('close')).toBe(true);
	});

	it('passes websocket message through the protocol handler', function(){
		connection.readRaw = sinon.spy();
		nativeWebSocket.addEventListener.withArgs('message').firstCall.args[1]({data:123});
		expect(connection.readRaw.calledWith(123)).toBe(true);
	});

	it('writes messages to the data channel', function(){
		nativeWebSocket.readyState = WebSocket.OPEN;
		connection.writeRaw('abc');
		expect(nativeWebSocket.send.calledWith('abc')).toBe(true);
	});

	it('contains all properties of Connection and JSONProtocol', function(){
		for(var property in JSONProtocol.prototype){
			if(JSONProtocol.prototype.hasOwnProperty(property)){
				expect(property in connection).toBe(true);
			}
		}
		
		for(property in Connection.prototype){
			if(Connection.prototype.hasOwnProperty(property)){
				expect(property in connection).toBe(true);
			}
		}
	});
});