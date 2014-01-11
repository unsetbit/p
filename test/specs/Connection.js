describe('Connection', function(){
	var Connection,
		mockEmitter;

	function createMockEmitter(){
		return {
			on: sinon.spy(),
			removeListener: sinon.spy(),
			emit: sinon.spy()
		}
	};

	function createConnection

	beforeEach(function(){
		Connection = window.P.Connection;
	});

	describe('constructor', function(){
		it('creates a Connection object when called', function(){
			var connection = createMockEmitter();
			var rtcConnection = createMockEmitter();
			var wsConnection = new Connection(connection, rtcConnection);

			expect(wsConnection instanceof Connection).toBe(true);
		});

		it('throws an error if required fields aren\'t provided', function(){
			var connection = createMockEmitter();
			var rtcConnection = createMockEmitter();

			expect(function(){new Connection()}).toThrow();
		
			expect(function(){new Connection(connection)}).toThrow();

			expect(function(){new Connection(undefined, rtcConnection)}).toThrow();
		});
	});

	describe('events', function(){

	});

	describe('connection management', function(){

	});
});