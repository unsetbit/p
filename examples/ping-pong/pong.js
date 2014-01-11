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

// Connect to the websocket server, onramp, which will help
// us connect to other browsers
webSocketPeer.connect('ws://' + location.hostname + ':20500/');
