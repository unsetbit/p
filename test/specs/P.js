describe('P', function(){
	var P,
		mockEmitter;

	function createMockEmitter(){
		return {
			on: sinon.spy(),
			emit: sinon.spy()
		}
	};

	beforeEach(function(){
		P = window.P;
		mockEmitter = createMockEmitter();
	});

	describe('constructor', function(){
		it('creates a P object when called', function(){
			var myP = new P(mockEmitter);

			expect(myP instanceof P).toBe(true);

			myP.on('test', function(){});

			expect(mockEmitter.on.calledWith('test')).toBe(true);
		});

		it('throws an error if no emitter is provided', function(){
			expect(function(){new P()}).toThrow();
		});

		it('has no connections upon creation', function(){
			var myP = new P(mockEmitter);
			expect(myP.getConnections().length).toBe(0);
		});
	});

	describe('factory', function(){
		it('Creates a P object and returns the api when called', function(){
			var myP = P.create();

			expect(myP instanceof P).not.toBe(true);
			expect(myP.on).not.toBeUndefined();
		});

		it('accepts an emitter as on option', function(){
			var myP = P.create({emitter:mockEmitter});
			myP.on('test', function(){});

			expect(mockEmitter.on.calledWith('test')).toBe(true);
		});
	});

	it('provides an api', function(){
		var myP = P.create();
		expect(myP.on).not.toBeUndefined();
		expect(myP.removeListener).not.toBeUndefined();
		expect(myP.to).not.toBeUndefined();
		expect(myP.connections).not.toBeUndefined();
	});

	it('keeps track of new connections', function(){
		var myP = new P(mockEmitter);

		var mockConnection = createMockEmitter();

		expect(myP.getConnections().length).toBe(0);

		myP.connectionHandler(mockConnection);

		expect(myP.getConnections()[0]).toBe(mockConnection);
		expect(myP.getConnections().length).toBe(1);
	});

	it('emits new connections', function(){
		var myP = new P(mockEmitter);
		var mockConnection = createMockEmitter();

		myP.connectionHandler(mockConnection);

		expect(mockEmitter.emit.calledWith('connection', mockConnection)).toBe(true);
	});

	it('stops tracking connection after it closes', function(){
		var myP = new P(mockEmitter);
		var mockConnection = createMockEmitter();
		var onClose = mockConnection.on.withArgs('close');
		myP.connectionHandler(mockConnection);

		expect(myP.getConnections().length).toBe(1);
		
		onClose.firstCall.args[1](); // calls the onClose callback
		
		expect(myP.getConnections().length).toBe(0);
	});

	it('tracks for connections of connections', function(){
		var myP = new P(mockEmitter);
		var mockConnection = createMockEmitter();
		var onConnection = mockConnection.on.withArgs('connection');
		myP.connectionHandler(mockConnection);

		expect(myP.getConnections().length).toBe(1);
		
		var mockConnection2 = createMockEmitter();
		onConnection.firstCall.args[1](mockConnection2); // calls the onClose callback
		
		expect(myP.getConnections().length).toBe(2);
	});

	it('continues to track connections of connections after parent connection closes', function(){
		var myP = new P(mockEmitter);
		var mockConnection = createMockEmitter();
		var onConnection = mockConnection.on.withArgs('connection');
		var onClose = mockConnection.on.withArgs('close');

		myP.connectionHandler(mockConnection);

		var mockConnection2 = createMockEmitter();
		onConnection.firstCall.args[1](mockConnection2); // calls the onClose callback

		onClose.firstCall.args[1](); // calls the onClose callback
		
		expect(myP.getConnections()[0]).toBe(mockConnection2);
		expect(myP.getConnections().length).toBe(1);
	});
});