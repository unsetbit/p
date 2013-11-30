describe('Initialization', function(){
	it('puts P in global scope', function(){
		expect(window.P).not.toBeUndefined();
	});
});