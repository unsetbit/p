describe('ConnectionManager', function(){
	var connectionManager,
		mockConnection;

	beforeEach(function(){
		connectionManager = new window.ConnectionManager();
		mockConnection = {address: '123'};
	});

	it('throws an error if an added connection has no address', function(){
		expect(function(){
			connectionManager.add({address: {anObject: true}});
		}).toThrow();
	});

	it('can keep track of connections by address', function(){
		expect(connectionManager.get().length).toBe(0);
		var result = connectionManager.add(mockConnection);
		
		expect(result).toBe(true);
		expect(connectionManager.get().length).toBe(1);
		expect(connectionManager.get('123')).toBe(mockConnection);
	});

	it('returns false if an address is already taken', function(){
		expect(connectionManager.get().length).toBe(0);
		var result = connectionManager.add(mockConnection);
		expect(result).toBe(true);
		expect(connectionManager.get().length).toBe(1);
		
		result = connectionManager.add(mockConnection);
		expect(result).toBe(false);
		expect(connectionManager.get().length).toBe(1);
		
		result = connectionManager.add({address: '123'});
		expect(result).toBe(false);
		expect(connectionManager.get().length).toBe(1);
	});

	it('returns false if an untracked connection is attempted to be removed', function(){
		var result = connectionManager.remove(mockConnection);
		expect(result).toBe(false);

		// should also fail with a 'lookalike' connection with the same address
		connectionManager.add(mockConnection);
		result = connectionManager.remove({address: '123'});
		expect(result).toBe(false);
	});

	it('returns true if a tracked connection is removed', function(){
		connectionManager.add(mockConnection);
		var result = connectionManager.remove(mockConnection);
		expect(result).toBe(true);
	});

	it('called onAdd when an address is added', function(){
		connectionManager.onAdd = sinon.spy();
		expect(connectionManager.onAdd.calledOnce).toBe(false);
		connectionManager.add(mockConnection);
		expect(connectionManager.onAdd.calledOnce).toBe(true);
	});

	it('calls onRemove when an address is removed', function(){
		connectionManager.onRemove = sinon.spy();
		connectionManager.add(mockConnection);
		expect(connectionManager.onRemove.calledOnce).toBe(false);
		connectionManager.remove(mockConnection);
		expect(connectionManager.onRemove.calledOnce).toBe(true);
	});

	it('returns a copy of all connections when get is called without an address', function(){
		connectionManager.add(mockConnection);
		connectionManager.add({address: 'abc'});
		var connections = connectionManager.get();
		expect(connections.length).toBe(2);
		expect(connections[0]).toBe(mockConnection);

		var connections2 = connectionManager.get();
		expect(connections).not.toBe(connections2);
	});
});