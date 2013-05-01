var bob = P.create();
var bobToServer = bob.to('ws://127.0.0.1:20500/');

bob.on('connection', function(connection){
	connection.send('Hello from Bob!');
	connection.on('message', function(message){
		console.log('bob peer message', message);
	});
});

