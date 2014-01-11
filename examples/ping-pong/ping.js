function loggify(obj, functionName, namespace){
	var prevFunc = obj[functionName];
	
	var logPrefix;

	if(~prevFunc.toString().indexOf('native code')) return;
	
	if(namespace){
		logPrefix = namespace + ':' + functionName;
	} else {
		logPrefix = functionName;
	}
	
	obj[functionName] = function(){
		console.log(logPrefix, arguments);
		
		var result = prevFunc.apply(this, arguments);

		return result;
	};
}

function loggifyObject(obj, objName){
	for(var key in obj.prototype){
		if(obj.prototype.hasOwnProperty(key) && typeof obj.prototype[key] === 'function'){
			loggify(obj.prototype, key, objName);
		}
	}
}

loggifyObject(P, 'p');
loggifyObject(P.Connection, 'connection');
loggifyObject(P.WebRtcConnection, 'webRtcConnection');
loggifyObject(P.WebSocketConnection, 'webSocketConnection');

// Create the root peer node
var webSocketPeer = new P();

// Listen to the messages the onramp server sends
webSocketPeer.on('message', function(message){
	console.log(arguments);
	// If we recieve a remote address, start pinging it
	if(message === "remote address"){
		var peerAddress = arguments[1];
		startPinging(peerAddress);
	}
});

function startPinging(address){
	// Establish an RTC channel to the given address
	var webRtcPeer = new P();

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

	webRtcPeer.connect(address, webSocketPeer);
}

webSocketPeer.connect('ws://' + location.hostname + ':20500/');
