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


var connections = [];

function onrampHandler(onramp){
	// Listen to messages from the onramp
	onramp.on('message', function(){
		// If the onramp gives us remote addresses, connect to them
		if(arguments[0] === "remote address"){
			var remoteAddress = arguments[1];

			// Connect to remote peer via the onramp
			var peer = new P();
			peer.connect(remoteAddress, onramp);
			connections.push(peer);
			
			peer.on('open', function(){
				peer.send("Welcome to the party, I'm Bob!");

				connections.forEach(function(other){
					if(other === peer) return;
					
					console.log('I\'m offering to connect ' + other.address + ' and ' + peer.address);

					peer.send('I can connect you to someone else', other.address);
					other.send('I can connect you to someone else', peer.address);
				});
			});
		}
	});
}

// Create the root node
var onramp1 = new P();

onramp1.connect('ws://' + location.hostname + ':20500/');

var onramp2 = new P();
onramp2.connect('ws://' + location.hostname + ':20400/');

onramp1.on('open', function(){
	console.log('I connected to the onramp at ws://' + location.hostname + ':20500/');
	onrampHandler(onramp1);
});

onramp2.on('open', function(){
	console.log('I connected to the onramp at ws://' + location.hostname + ':20400/');
	onrampHandler(onramp2);
});