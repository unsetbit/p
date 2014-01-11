describe('RtcConnection', function(){
	var RtcConnection,
		mockEmitter;

	function createMockEmitter(){
		return {
			on: sinon.spy(),
			removeListener: sinon.spy(),
			emit: sinon.spy()
		}
	};

	beforeEach(function(){
		RtcConnection = window.P.RtcConnection;
	});

	describe('constructor', function(){
		it('creates a RtcConnection object when called', function(){
			var connection = createMockEmitter();
			var rtcConnection = createMockEmitter();
			var wsConnection = new RtcConnection(connection, rtcConnection);

			expect(wsConnection instanceof RtcConnection).toBe(true);
		});

		it('throws an error if required fields aren\'t provided', function(){
			var connection = createMockEmitter();
			var rtcConnection = createMockEmitter();

			expect(function(){new RtcConnection()}).toThrow();
		
			expect(function(){new RtcConnection(connection)}).toThrow();

			expect(function(){new RtcConnection(undefined, rtcConnection)}).toThrow();
		});
	});

	describe('events', function(){

	});

	describe('connection management', function(){

	});
});