var pingingAnarch = Anarch.create();

// Greeter greets connects to and greets every address the websocket sends it
var webSocketConnection = pingingAnarch.to('ws://192.168.0.101:20500/');

webSocketConnection.on('message', function(message){
	if(message === "remote address"){
		startPinging(arguments[1]);
	}
});

function startPinging(address){
	var rtcConnection = webSocketConnection.to(address);

	rtcConnection.on('open', function(){
		rtcConnection.send('Ping?');
	});

	rtcConnection.on('message', function(message){
		console.log('Got: ' + message);

		setTimeout(function(){
			rtcConnection.send('Ping?');	
		}, 1000);
	});
}