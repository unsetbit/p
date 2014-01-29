# <a href="http://ozan.io/p">P</a> is for peer-to-peer networking with browsers

P is a small framework used to create browser-to-browser networks (as opposed to just a connection). With P, you can:

* Connect to other browsers using [a simple WebSocket server](https://github.com/oztu/onramp).
* Connect to other browsers using your established connections to other browsers. This is what makes P unique: it allows for transitive connections across peers, allowing easy creation of mesh networks.

After a connection is established the middleman is no longer nescessary – no proxies are involved.

This is made possible by an unstable and young technology -- [WebRTC](http://www.webrtc.org/). 
Currently, only Chrome and Firefox support this technology.

[onramp](https://github.com/oztu/onramp), a simple WebSocket server, is used as the signaling channel 
to establish initial connections.

## API
```javascript
// Initializing
var rootNode = P.create(); // create the root node

// Connection management
var webSocketNode = rootNode.connect(address); // connect to an onramp WebSocket server
var webRtcNode = webSocketNode.connect(address); // connect to a peer using an onramp connection
var webRtcNode = webRtcNode.connect(address); // connect to a peer using an existing peer connection
anyNode.close(); // close the connection
anyNode.isOpen(); // return true if the connection is open
var nodeArray = anyNode.getPeers(); // returns an array of all peer connections

// Firewalling connections
var protectedNode = P.create({
  firewall: function(offerData){
    // Only accept RTC connection offers which send 'secret' as the offer data
    // this firewall rule will apply to any child nodes as well
    return offerData === 'secret';
  }
});


// Send offerData with a connection request
anyNode.connect({address: address, offerData: 'secret'});


// Sending and receiving messages
webRtcNode.send(message); // send a message to a peer; can be json, string, or arraybuffer
webRtcNode.on('message', function(message){}); // listens for messages from a peer
webRtcNode.on('array buffer', function(arrayBuffer){}); // listens for array buffers from a peer

// Events
anyNode.on('connection', function(peerNode){}); // emitted when a connection is made via this peer
anyNode.on('open', function(){}); // emitted when this connection is open and ready
anyNode.on('close', function(){}); // emitted when this connection is closed
anyNode.on('error', function(err){}); // listens for errors for this connection
anyNode.removeListener(eventName, optionalCallback); // stops listening to an event
```


## Documentation
* [Example with walkthrough](http://ozan.io/p/#walkthrough)
* [API](http://ozan.io/p/#use)
* [Cookbook](http://ozan.io/p/#cookbook)
* [Contribute](http://ozan.io/p/#contribute)

## Release Notes
* 0.3.1 - Added 'firewall' option to firewall RTC requests.
* 0.3 - Major refactor of internals and simplification of API, Firefox support, and respectable unit test coverage.
* 0.2 - Public release
