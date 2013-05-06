// This script is for the node which will act as an "onramp" for other peers.
// Sets the onramp address to the default
var onrampAddress = 'ws://' + location.hostname + ':20500/';

// Create the root peer node
var rootNode = P.create();

// Whenever a connection is established, tell it about all the 
// other connections available, and then broadcast its connection
// id to the rest of the connections so everyone always
// knows who is connected to the onramp
rootNode.on('connection', function(connection){
  rootNode.connections.forEach(function(other){
    // Don't send a connection its own id
    if(other === connection) return;
    
    connection.send('remote address', other.id);
    other.send('remote address', connection.id);
  });
});

// Connect to the websocket server, onramp, which will help
// us connect to other browsers
rootNode.to(onrampAddress);