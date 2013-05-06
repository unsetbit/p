// Create the root peer node
var pingingPeer = P.create();

// Connect to the websocket server, onramp, which will help
// us connect to other browsers
var webSocketPeer = pingingPeer.to('ws://' + location.hostname + ':20500/');

// Listen to the messages the onramp server sends
webSocketPeer.on('message', function(message){
	// If we recieve a remote address, start pinging it
	if(message === "remote address"){
		var peerAddress = arguments[1];
		startPinging(peerAddress);
	}
});

function startPinging(address){
	// Establish an RTC channel to the given address
	var webRtcPeer = webSocketPeer.to(address);

	// Once the channel is open, send the initial ping
	webRtcPeer.on('open', function(){
		webRtcPeer.send('Ping?');
	});

	// Whenever we recieve a message back, output it to the console,
	// wait one second, then respond with another ping
	webRtcPeer.on('message', function(message){
		console.log('I received: ' + message);

		setTimeout(function(){
			webRtcPeer.send('Ping?');	
		}, 1000);
	});
}