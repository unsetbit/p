describe('P', function(){
	var P,
		mockEmitter,
		mockConnectionManager,
		mockConnection,
		originalWebSocketCreate = window.WebSocketConnection.create;

	beforeEach(function(){
		P = window.P;
		mockEmitter = createMockEmitter();
		mockConnectionManager = createMockConnectionManager();
		mockConnection = createMockEmitter();
		sinon.stub(window.WebSocketConnection, 'create').returns(mockConnection);	
	});

	afterEach(function(){
		window.WebSocketConnection.create = originalWebSocketCreate;
	});

	describe('construction', function(){
		it('constructor creates a P object when called', function(){
			var p = new P(mockEmitter, mockConnectionManager);

			p.on('test', function(){});

			expect(mockEmitter.on.calledWith('test')).toBe(true);
		});

		it('constructor throws an error if no emitter is provided', function(){
			expect(function(){new P()}).toThrow();
		});

		it('factory creates a P object and returns the api when called', function(){
			var p = P.create();
			expect(p.on).not.toBeUndefined();
		});

		it('new instances have no connections upon creation', function(){
			var p = P.create();
			expect(p.getPeers().length).toBe(0);
		});
	});

	describe('connection management', function(){
		it('creates websocket connections by default', function(){
			var p = new P(mockEmitter, mockConnectionManager);

			p.connect('ws://test/');

			expect(mockConnectionManager.add.calledWith(mockConnection)).toBe(true);
		});

		it('stops tracking closed connections', function(){
			var p = new P(mockEmitter, mockConnectionManager);

			var spy = mockConnection.on.withArgs('close');
			
			p.connect('ws://test/');

			spy.firstCall.args[1]();

			expect(mockConnectionManager.remove.calledWith(mockConnection)).toBe(true);
		});
	});

	describe('events', function(){
		it('emits new connections', function(){
			var p = new P(mockEmitter, mockConnectionManager);
			
			var mockConnection = createMockEmitter();
			mockConnectionManager.onAdd(mockConnection);
			
			expect(mockEmitter.emit.calledWith('connection', mockConnection)).toBe(true);
		});

		it('emits disconnections', function(){
			var p = new P(mockEmitter, mockConnectionManager);
			
			var mockConnection = createMockEmitter();
			mockConnectionManager.onRemove(mockConnection);

			expect(mockEmitter.emit.calledWith('disconnection', mockConnection)).toBe(true);
		});

		it('allows binding for listening to events', function(){
			var p = new P(mockEmitter, mockConnectionManager);
			var mySpy = sinon.spy();
			p.on('connection', mySpy);

			expect(mockEmitter.on.calledWith('connection', mySpy));
		});

		it('allows removals of bound listeners', function(){
			var p = new P(mockEmitter, mockConnectionManager);
			var mySpy = sinon.spy();
			p.removeListener('connection', mySpy);

			expect(mockEmitter.removeListener.calledWith('connection', mySpy));
		});
	});
});