// Create the root node
var alice = P.create();

// Establish a WebSocket connection to the onramp server
var onramp = alice.to('ws://' + location.hostname + ':20500/');

// This is purely for logging so we can see when the onramp connection opened
onramp.on('open', function(){
	console.log('I connected to the onramp at ws://' + location.hostname + ':20500/');
});

// Whenever Alice is connected to a new peer, this event will fire. This includes both
// WebRTC and WebSocket peers
alice.on('connection', function(peer){
	var isBob = false;

	// Listen for messages from peers. Messages may have any number of arguments
	// so we refer to them by index
	peer.on('message', function(){

		// Bob will welcome anyone who connects to him, this
		// helps us identify which peer is Bob
		if(arguments[0] === "Welcome to the party, I'm Bob!"){
			isBob = true;
			console.log("I joined Bob's party!");

		// After introducing himself, Bob will send his connections the remote addresses
		// of all the other connections to him, we'll use this information to ask
		// Bob to help connect us to those peers
		} else if(isBob && arguments[0] === 'I can connect you to someone else'){
			console.log('Bob says I can connect to', arguments[1]);

			// arguments[1] is the remote address that can be used to connect to a peer
			// through Bob
			var otherPeer = peer.to(arguments[1]);
			
			// When successfully connected to a peer through Bob, introduce self
			otherPeer.on('open', function(){
				console.log("I'm introducing myself to Bob's friend (" + otherPeer.id + ")");
				otherPeer.send("Hi, I'm Alice!");
			});

			otherPeer.on('message', function(message){
				console.log("Bob's friend (" + otherPeer.id + ") says \"" + message + "\"");
			});
		}
	});
});
