// Create the root node
var charlie = new P();

// Establish a WebSocket connection to the onramp server
charlie.connect('ws://' + location.hostname + ':20400/');

// This is purely for logging so we can see when the onramp connection opened
charlie.on('open', function(){
	console.log('I connected to the onramp at ws://' + location.hostname + ':20400/');
});

// Whenever Charlie is connected to a new peer, this event will fire. This includes both
// WebRTC and WebSocket peers
charlie.on('connection', function(peer){
	console.log(peer);
	console.log(peer.address + " connected with me, I'll say hello.");

	peer.on('open', function(){
		peer.send("Hi, I'm Charlie!");
	});
	
	peer.on('message', function(message){
		console.log(peer.address + ' said ' + message);
	});
});
