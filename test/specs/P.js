var sinon = require('sinon');
var util = require('../util');

describe('P', function(){
	var P,
		mockEmitter,
		mockConnectionManager,
		mockConnection,
		originalWebSocketCreate = util.WebSocketConnection.create;

	beforeEach(function(){
		P = util.P;
		mockEmitter = util.createMockEmitter();
		mockConnectionManager = util.createMockConnectionManager();
		mockConnection = util.createMockEmitter();
		sinon.stub(util.WebSocketConnection, 'create').returns(mockConnection);
	});

	afterEach(function(){
		util.WebSocketConnection.create = originalWebSocketCreate;
	});

	describe('construction', function(){
		it('constructor creates a P object when called', function(){
			var p = new P(mockEmitter, mockConnectionManager);

			p.on('test', function(){});

			expect(mockEmitter.on.calledWith('test')).toBe(true);
		});

		it('constructor throws an error if no emitter is provided', function(){
			expect(function(){new P();}).toThrow();
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
			new P(mockEmitter, mockConnectionManager);

			var mockConnection = util.createMockEmitter();
			mockConnectionManager.onAdd(mockConnection);

			expect(mockEmitter.emit.calledWith('connection', mockConnection)).toBe(true);
		});

		it('emits disconnections', function(){
			new P(mockEmitter, mockConnectionManager);

			var mockConnection = util.createMockEmitter();
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
