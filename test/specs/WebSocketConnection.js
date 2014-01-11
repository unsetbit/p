describe('WebSocketConnection', function(){
	var WebSocketConnection,
		mockEmitter;

	function createMockEmitter(){
		return {
			on: sinon.spy(),
			removeListener: sinon.spy(),
			emit: sinon.spy()
		}
	};

	beforeEach(function(){
		WebSocketConnection = window.P.WebSocketConnection;
	});

	describe('constructor', function(){
		it('creates a WebSocketConnection object when called', function(){
			var connection = createMockEmitter();
			var socket = createMockEmitter();
			var wsConnection = new WebSocketConnection(connection, socket);

			expect(wsConnection instanceof WebSocketConnection).toBe(true);
		});

		it('throws an error if required fields aren\'t provided', function(){
			var connection = createMockEmitter();
			var socket = createMockEmitter();

			expect(function(){new WebSocketConnection()}).toThrow();
		
			expect(function(){new WebSocketConnection(connection)}).toThrow();

			expect(function(){new WebSocketConnection(undefined, socket)}).toThrow();
		});
	});

	describe('events', function(){

	});

	describe('connection management', function(){

	});
});