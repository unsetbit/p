describe('JSONProtocol', function(){
	var protocol;

	beforeEach(function(){
		protocol = new JSONProtocol();
	});
	
	it('throws an error when unimplemented methods are called', function(){
		expect(function(){
			protocol.readMessage();
		}).toThrow();

		expect(function(){
			protocol.readArrayBuffer();
		}).toThrow();

		expect(function(){
			protocol.readRelay();
		}).toThrow();

		expect(function(){
			protocol.readRelayedOffer();
		}).toThrow();

		expect(function(){
			protocol.readRelayedAnswer();
		}).toThrow();

		expect(function(){
			protocol.readRelayedIceCandidate();
		}).toThrow();

		expect(function(){
			protocol.writeRaw();
		}).toThrow();
	});

	it('calls seperates array buffer messages from protocol message', function(){
		protocol.readArrayBuffer = sinon.spy();
		protocol.readProtocolMessage = sinon.spy();

		protocol.readRaw('[1,"abc"]');
		expect(protocol.readArrayBuffer.calledOnce).toBe(false);
		expect(protocol.readProtocolMessage.calledOnce).toBe(true);

		protocol.readRaw(new ArrayBuffer(16));
		expect(protocol.readArrayBuffer.calledOnce).toBe(true);
		expect(protocol.readProtocolMessage.calledOnce).toBe(true);
	});

	it('throws an error if an invalid protocol message is fed in', function(){
		expect(function(){
			protocol.readProtocolMessage('not json');
		}).toThrow();

		expect(function(){
			protocol.readProtocolMessage(JSON.stringify([9999, 'test']));
		}).toThrow();
	});

	it('routes direct messages to readMessage', function(){
		var direct = [protocol.MESSAGE_TYPE.DIRECT, 'test'];

		protocol.readMessage = sinon.spy();
		protocol.readProtocolMessage(direct);
		expect(protocol.readMessage.calledWith('test')).toBe(true);
	});

	it('routes relayed offers to readRelayedOffer', function(){
		var offer = [protocol.MESSAGE_TYPE.RTC_OFFER, 'description', 'data'],
			relayedOffer = [protocol.MESSAGE_TYPE.RELAYED, '123', offer];

		protocol.readRelayedOffer = sinon.spy();
		protocol.readProtocolMessage(relayedOffer);
		expect(protocol.readRelayedOffer.calledWith('123', 'description', 'data')).toBe(true);
	});

	it('routes relayed answers to readRelayedAnswer', function(){
		var answer = [protocol.MESSAGE_TYPE.RTC_ANSWER, 'description'],
			relayedAnswer = [protocol.MESSAGE_TYPE.RELAYED, '123', answer];
			
		protocol.readRelayedAnswer = sinon.spy();
		protocol.readProtocolMessage(relayedAnswer);
		expect(protocol.readRelayedAnswer.calledWith('123', 'description')).toBe(true);
	});

	it('routes relayed ice candidates to readRelayedIceCandidate', function(){
		var iceCandidate = [protocol.MESSAGE_TYPE.RTC_ICE_CANDIDATE, 'description'],
			relayedIceCandidate = [protocol.MESSAGE_TYPE.RELAYED, '123', iceCandidate];
			
		protocol.readRelayedIceCandidate = sinon.spy();
		protocol.readProtocolMessage(relayedIceCandidate);
		expect(protocol.readRelayedIceCandidate.calledWith('123', 'description')).toBe(true);
	});

	it('routes relay messages to readRelay', function(){
		var offer =  [protocol.MESSAGE_TYPE.RTC_OFFER, 'description', {data:123}],
			relay =  [protocol.MESSAGE_TYPE.RELAY, 'abc', offer.slice()];

		protocol.readRelay = sinon.spy();
		protocol.readProtocolMessage(relay);
		expect(protocol.readRelay.calledWith('abc', offer)).toBe(true);
	});

	it('writes array buffers directly to transport', function(){
		var arrayBuffer = new ArrayBuffer(16);
		protocol.writeRaw = sinon.spy();

		protocol.writeMessage(arrayBuffer);
		expect(protocol.writeRaw.calledWith(arrayBuffer)).toBe(true);
	});

	it('wrap JSON messages with protocol envelop', function(){
		var message = {test: 123};
		protocol.writeRaw = sinon.spy();

		protocol.writeMessage(message);
		protocol.writeRaw.calledWith('[0,{test:123}]');
	});
});