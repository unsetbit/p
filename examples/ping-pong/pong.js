var pongingAnarch = Anarch.create();

// First, establish a connection to the onramp which will 
// help us connect to other browsers
var webSocketConnection2 = pongingAnarch.to('ws://127.0.0.1:20500/');

// Whenever an RTC channel is established, call the handler function
webSocketConnection2.on('connection', handleRtcConnection);

function handleRtcConnection(rtcConnection){
	// When ever another browser connects, listen for messages
	rtcConnection.on('message', function(message){
		// Output the message
		console.log('Got: ' + message);

		// Wait one second then respond with a pong
		setTimeout(function(){
			rtcConnection.send('Pong!');
		}, 1000);
	});	
}
