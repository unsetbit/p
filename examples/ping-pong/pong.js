// Create the root peer node
var pongingPeer = P.create();

// Connect to the websocket server, onramp, which will help
// us connect to other browsers
var webSocketPeer = pongingPeer.to('ws://127.0.0.1:20500/');

// Whenever an RTC channel is established, call the handler function
webSocketPeer.on('connection', handleRtcConnection);

function handleRtcConnection(webRtcPeer){
	// When ever another browser connects, listen for messages
	webRtcPeer.on('message', function(message){
		// Output the message
		console.log('I received: ' + message);

		// Wait one second then respond with a pong
		setTimeout(function(){
			webRtcPeer.send('Pong!');
		}, 1000);
	});	
}
