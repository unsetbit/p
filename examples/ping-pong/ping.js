var pingingAnarch = Anarch.create();

// First, establish a connection to the onramp which will 
// help us connect to other browsers
var webSocketConnection = pingingAnarch.to('ws://127.0.0.1:20500/');

// Listen to the messages the onramp server sends
webSocketConnection.on('message', function(message){
	// If we recieve a remote address, start pinging it
	if(message === "remote address"){
		startPinging(arguments[1]);
	}
});

function startPinging(address){
	// Establish an RTC channel to the given address
	// The address in this case is a random string that the onramp
	// server sent us as a proxy for the browser we can try to connect
	// to
	var rtcConnection = webSocketConnection.to(address);

	// Once the channel is open, send the initial ping
	rtcConnection.on('open', function(){
		rtcConnection.send('Ping?');
	});

	// When ever we recieve a message back, output it to the console,
	// wait one second, then respond with another ping
	rtcConnection.on('message', function(message){
		console.log('Got: ' + message);

		setTimeout(function(){
			rtcConnection.send('Ping?');	
		}, 1000);
	});
}