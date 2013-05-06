// This script uses the connection from the pervious script to expand it's network.

// An array in which we'll keep our peers
var peers = [];

// Sets the onramp address to the default
var onrampAddress = 'ws://' + location.hostname + ':20500/';

// Create the root peer node
var rootNode = P.create();

// Connect to the websocket server, onramp, which will help
// us connect to other browsers
var onrampPeer = rootNode.to(onrampAddress);

// Listen to the messages the onramp server sends
onrampPeer.on('message', function(){
  // If we recieve a remote address, establish a connection to it
  if(arguments[0] === "remote address"){
    // If the first argument is "remote address", the second 
    // argument should be the address of the peer.
    var peerAddress = arguments[1];

    // Connect to peer
    var rtcPeer = onrampPeer.to(peerAddress);

    // Bind event handlers to peer
    rtcPeerHandler(rtcPeer)
  }
});

function rtcPeerHandler(rtcPeer){
  // Listen for 'remote address' messages from peer
  rtcPeer.on('message', function(){
    if(arguments[0] === 'remote address'){
      // If the rtc peer provides a remote address, try
      // to connect to it
      var otherPeerAddress = arguments[1];
      var peer = rtcPeer.to(otherPeerAddress);
      console.log('hit', otherPeerAddress);
        
      // When the connection opens, add it to the peers array
      peer.on('open', function(){
        console.log('peer connection open');
        peers.push(peer);
      });
    }
  });
}