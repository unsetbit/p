// Listener listens to every message from each connection made to it
var pongingAnarch = Anarch.create();

var webSocketConnection2 = pongingAnarch.to('ws://127.0.0.1:20500/');
webSocketConnection2.on('connection', handleRtcConnection);

function handleRtcConnection(rtcConnection){
	rtcConnection.on('message', function(message){
		console.log('Got: ' + message);

		setTimeout(function(){
			rtcConnection.send('Pong!');
		}, 1000);
	});	
}
