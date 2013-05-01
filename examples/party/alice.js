var alice = P.create();
var aliceToServer = alice.to('ws://127.0.0.1:20500/');

alicePeers = [];

aliceToServer.on('message', function(message){
	if(message === "remote address"){
		var remoteAddress = arguments[1];
		var peer = aliceToServer.to(remoteAddress);
		
		alicePeers.push(peer);
					
		peer.on('open', function(){
			console.log('peer open', peer.id);
			if(alicePeers[0] !== peer){
				console.log('ask', peer.id, 'to hookup with', alicePeers[0].id);
				peer.send('hook up with', alicePeers[0].id);	
			}
		});
	}
});
