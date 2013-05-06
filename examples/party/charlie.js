// Create the root node
var charlie = P.create();

// Establish a WebSocket connection to the onramp server
var onramp = charlie.to('ws://' + location.hostname + ':20400/');

// This is purely for logging so we can see when the onramp connection opened
onramp.on('open', function(){
	console.log('I connected to the onramp at ws://' + location.hostname + ':20400/');
});

// Whenever Charlie is connected to a new peer, this event will fire. This includes both
// WebRTC and WebSocket peers
charlie.on('connection', function(peer){
	// We don't want to do anything when we establish a connection to the
	// onramp peer
	if(peer.id === onramp.id) return;

	console.log(peer.id + " connected with me, I'll say hello.");
	peer.send("Hi, I'm Charlie!");

	peer.on('message', function(message){
		console.log(peer.id + ' said ' + message);
	});
});
