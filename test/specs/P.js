describe('P', function(){
	var P,
		mockEmitter;

	function createMockEmitter(){
		return {
			on: sinon.spy(),
			removeListener: sinon.spy(),
			emit: sinon.spy()
		}
	};

	beforeEach(function(){
		P = window.P;
		mockEmitter = createMockEmitter();
	});

	describe('construction', function(){
		it('constructor creates a P object when called', function(){
			var myP = new P(mockEmitter);

			expect(myP instanceof P).toBe(true);

			myP.on('test', function(){});

			expect(mockEmitter.on.calledWith('test')).toBe(true);
		});

		it('constructor throws an error if no emitter is provided', function(){
			expect(function(){new P()}).toThrow();
		});

		it('factory creates a P object and returns the api when called', function(){
			var myP = P.create();

			expect(myP instanceof P).toBe(false);
			expect(myP.on).not.toBeUndefined();
		});

		it('factory accepts an emitter as on option', function(){
			var myP = P.create({emitter:mockEmitter});
			myP.on('test', function(){});

			expect(mockEmitter.on.calledWith('test')).toBe(true);
		});

		it('factory returns api, not instance', function(){
			var myP = P.create();
			expect(myP instanceof P).toBe(false);
			expect(myP.on).not.toBeUndefined();
			expect(myP.removeListener).not.toBeUndefined();
			expect(myP.to).not.toBeUndefined();
			expect(myP.connections).not.toBeUndefined();
		});

		it('new instances have no connections upon creation', function(){
			var myP = new P(mockEmitter);
			expect(myP.getConnections().length).toBe(0);
		});
	});

	describe('connection management', function(){
		it('keeps track of new connections', function(){
			var myP = new P(mockEmitter);

			var mockConnection = createMockEmitter();

			expect(myP.getConnections().length).toBe(0);

			myP.connectionHandler(mockConnection);

			expect(myP.getConnections()[0]).toBe(mockConnection);
			expect(myP.getConnections().length).toBe(1);
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

		it('calling .to attempts to establish a connection to a websocket server', function(){
			var myP = new P(mockEmitter);
			
			var mockWsConnection = sinon.stub();
			var mySpy = myP.createWebSocketConnection = sinon.stub().returns(mockWsConnection);
			
			var mockApi = {
				on: sinon.spy()
			};
			mockWsConnection.getApi = sinon.stub().returns(mockApi);

			var result = myP.to('localhost');
			expect(result).toBe(mockApi);
		});

		it('automatically adds opened web socket connections to the connection pool', function(){
			var myP = new P(mockEmitter);
			
			var mockWsConnection = sinon.stub();
			var mySpy = myP.createWebSocketConnection = sinon.stub().returns(mockWsConnection);
			
			var mockApi = {
				on: sinon.spy()
			};
			var onOpen = mockApi.on.withArgs('open');
			mockWsConnection.getApi = sinon.stub().returns(mockApi);

			var result = myP.to('localhost');
			
			expect(myP.getConnections().length).toBe(0);

			onOpen.firstCall.args[1](); // emit 'open' event

			expect(myP.getConnections().length).toBe(1);
		});

		it('can track at least 1000 connections', function(){
			var myP = new P(mockEmitter),
				counter = 1000,
				closeQueue = [],
				mockConnecion;

			expect(myP.getConnections().length).toBe(0);

			while(counter > 0){
				mockConnection = createMockEmitter();
				closeQueue.push(mockConnection.on.withArgs('close'));

				myP.connectionHandler(mockConnection);
				counter--;
			}
			
			expect(myP.getConnections().length).toBe(1000);

			closeQueue.forEach(function(onClose){
				onClose.firstCall.args[1]();
			});

			expect(myP.getConnections().length).toBe(0);
		});
	});

	describe('events', function(){
		it('emits new connections', function(){
			var myP = new P(mockEmitter);
			var mockConnection = createMockEmitter();

			myP.connectionHandler(mockConnection);

			expect(mockEmitter.emit.calledWith('connection', mockConnection)).toBe(true);
		});

		it('emits disconnections', function(){
			var myP = new P(mockEmitter);
			var mockConnection = createMockEmitter();
			var onClose = mockConnection.on.withArgs('close');

			myP.connectionHandler(mockConnection);

			onClose.firstCall.args[1](); // calls the onClose callback

			expect(mockEmitter.emit.calledWith('disconnection', mockConnection)).toBe(true);
		});

		it('allows binding for listening to events', function(){
			var myP = new P(mockEmitter);
			var mySpy = sinon.spy();
			myP.on('connection', mySpy);

			expect(mockEmitter.on.calledWith('connection', mySpy));
		});

		it('allows removals of bound listeners', function(){
			var myP = new P(mockEmitter);
			var mySpy = sinon.spy();
			myP.removeListener('connection', mySpy);

			expect(mockEmitter.removeListener.calledWith('connection', mySpy));
		});
	});
});