describe('Connection', function(){
	var mockConnectionManager,
		mockEmitter,
		connection,
		mockConnection,
		mockPeer,
		mockCreateWebRTCConnection,
		originalCreateWebRTCConnection = Connection.createWebRTCConnection;

	beforeEach(function(){
		mockConnection = createMockConnection();
		mockEmitter =  createMockEmitter();
		mockConnectionManager = createMockConnectionManager();
		mockPeer = mockConnectionManager.mockPeer;
		connection = new Connection('123', mockConnectionManager, {emitter: mockEmitter});
		mockCreateWebRTCConnection = sinon.stub(Connection, 'createWebRTCConnection').returns(mockConnection);
	});

	afterEach(function(){
		Connection.createWebRTCConnection = originalCreateWebRTCConnection;
	});

	describe('constructor', function(){
		it('creates a Connection object when called', function(){
			var connection = new Connection('123', mockConnectionManager, {emitter:mockEmitter});
			expect(connection instanceof Connection).toBe(true);
			expect(connection instanceof JSONProtocol).toBe(true);
		});

		it('throws an error if required fields aren\'t provided', function(){
			expect(function(){new Connection()}).toThrow();
		
			expect(function(){new Connection('123')}).toThrow();

			expect(function(){new Connection(123, mockConnectionManager)}).toThrow();
		});
	});

	it('creates a web rtc connection using itself as a signaling channel when connect is called', function(){
		var config = {address: '123'},
			result = connection.connect(config);

		expect(result).toBe(mockConnection);
		expect(mockCreateWebRTCConnection.calledWith(config, mockConnectionManager, connection)).toBe(true);
		expect(mockConnectionManager.add.calledWith(mockConnection)).toBe(true);
		expect(mockConnection.on.calledWith('close')).toBe(true);
		expect(mockEmitter.emit.calledWith('connection', mockConnection)).toBe(true);
	});

	it('removes disconnected peers from connection manager and emits the event', function(){
		var onCloseSpy = mockConnection.on.withArgs('close');
		var result = connection.connect('123');

		expect(mockConnectionManager.remove.calledWith(mockConnection)).toBe(false);
		expect(mockEmitter.emit.calledWith('disconnection', mockConnection)).toBe(false);
		
		onCloseSpy.firstCall.args[1]();
		expect(mockConnectionManager.remove.calledWith(mockConnection)).toBe(true);
		expect(mockEmitter.emit.calledWith('disconnection', mockConnection)).toBe(true);
	});

	it('emits received messages', function(){
		expect(mockEmitter.emit.calledWith('message')).toBe(false);
		connection.readMessage(123);
		expect(mockEmitter.emit.calledWith('message')).toBe(true);
	});

	it('relays messages through peers', function(){
		connection.readRelay('abc', 123);
		expect(mockPeer.writeRelayedMessage.calledWith(connection.address, 123)).toBe(true);
	});

	it('passes along relayed ice candidates from its peers', function(){
		connection.readRelayedIceCandidate('abc', 'def');
		expect(mockPeer.readIceCandidate.calledWith('def')).toBe(true);
	});

	it('passes along relayed answers from its peers', function(){
		connection.readRelayedAnswer('abc', 'def');
		expect(mockPeer.readAnswer.calledWith('def')).toBe(true);
	});

	it('creates a new web rtc connection when a peer makes an acceptable offer', function(){
		var onCloseSpy = mockConnection.on.withArgs('close');
		
		connection.readRelayedOffer('123', 'def', 123)
	
		expect(mockCreateWebRTCConnection.calledWith({address:'123'}, mockConnectionManager, connection)).toBe(true);
	
		expect(mockConnection.readOffer.calledWith('def')).toBe(true);
		expect(mockConnection.writeAnswer.calledOnce).toBe(true);
		expect(mockConnectionManager.add.calledWith(mockConnection)).toBe(true);
		expect(mockConnection.on.calledWith('close')).toBe(true);
	
		onCloseSpy.firstCall.args[1]();
		expect(mockConnectionManager.remove.calledWith(mockConnection)).toBe(true);
	});

	it('rejects offers when the acceptRTCConnection call returns false', function(){
		connection.acceptRTCConnection = function(){return false;}

		connection.readRelayedOffer('123', 'def', 123)
	
		expect(mockCreateWebRTCConnection.calledOnce).toBe(false);
		expect(mockEmitter.emit.calledWith('connection')).toBe(false);
	});

	it('emits a connection event when a new offer results in a connection', function(){
		connection.readRelayedOffer('123', 'def', 123)
		expect(mockEmitter.emit.calledWith('connection', mockConnection)).toBe(true);
	});

	it('emits a disconnection event when a connection it emitted closes', function(){
		var onCloseSpy = mockConnection.on.withArgs('close');
		connection.readRelayedOffer('123', 'def', 123)
		onCloseSpy.firstCall.args[1]();
		expect(mockEmitter.emit.calledWith('disconnection', mockConnection)).toBe(true);
	});

	it('throws an error when close is called because it isn\'t implemented', function(){
		expect(function(){
			connection.close();
		}).toThrow();

		expect(function(){
			connection.getReadyState();
		}).toThrow();


		expect(function(){
			connection.isOpen();
		}).toThrow();
	});

	it('has all of the methods of the JSONProtocol object', function(){
		for(var property in JSONProtocol.prototype){
			if(JSONProtocol.prototype.hasOwnProperty(property)){
				expect(property in connection).toBe(true);
			}
		}
	});
});