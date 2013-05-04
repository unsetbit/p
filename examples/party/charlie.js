var charlie = P.create();
var charlieToServer = charlie.to('ws://127.0.0.1:20500/');
charlie.on('connection', function(connection){
	connection.on('message', function(message){
		if(message === "remote address") return;

		if(message === "hook up with"){
			connection.send('I\'m Charlie');
			console.log("hook up with", arguments[1], "via", connection.id);
			var hookup = connection.to(arguments[1]);
			hookup.on('message', function(message){
				console.log('peer message:', message);
			});
		}
	});
});