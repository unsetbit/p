function onrampHandler(onramp){
	// Listen to messages from the onramp
	onramp.on('message', function(){
		// If the onramp gives us remote addresses, connect to them
		if(arguments[0] === "remote address"){
			var remoteAddress = arguments[1];

			// Connect to remote peer via the onramp
			var peer = onramp.to(remoteAddress);

			peer.on('open', function(){
				peer.send("Welcome to the party, I'm Bob!");

				bob.connections.forEach(function(other){
					if(other === peer) return;
					if(other.id === onramp1.id || other.id === onramp2.id) return;

					console.log('I\'m offering to connect ' + other.id + ' and ' + peer.id);

					peer.send('I can connect you to someone else', other.id);
					other.send('I can connect you to someone else', peer.id);
				});
			});
		}
	});
}

// Create the root node
var bob = P.create();

var onramp1 = bob.to('ws://' + location.hostname + ':20500/');
var onramp2 = bob.to('ws://' + location.hostname + ':20400/');

onramp1.on('open', function(){
	console.log('I connected to the onramp at ws://' + location.hostname + ':20500/');
	onrampHandler(onramp1);
});

onramp2.on('open', function(){
	console.log('I connected to the onramp at ws://' + location.hostname + ':20400/');
	onrampHandler(onramp2);
});