# P

Peer-to-peer, distributed networking is coming to the browser. P allows you to do two things:

1. Establish connections to other browsers using a WebSocket server.
2. Establish connections to other browsers using connections you've established to other browsers.

The second point is the magic. It allows you to do things like using a public server (WebSocket server) 
to start a network of peers and then disconnecting from the public server while persisting the existing network.

P relies on  young technology -- [WebRTC](http://www.webrtc.org/). Currently, only Chrome has the 
ability to establish the data channels between browsers that P relies on.

It uses [onramp](https://github.com/oztu/onramp), a simple WebSocket server, as the signaling channel to 
establish the connections.

## Example
```javascript
// In this example, we're going to connect to a WebSocket peer, wait for it to tell us
// about it's other browsers which are connected to it, and then establish connections
// directly to those browsers.

// Create a root p instance
var rootP = P.create();

// Connect to the WebSocket peer at ws://127.0.0.1:20500 
var webSocketPeer = rootP.to('ws://127.0.0.1:20500');

// Listen for JSON messages from webSocketP
webSocketPeer.on('message', function(myMessageType, myMessageArg){
  // Lets assume for this example that the WebSocket peer broadcasts
  // the addresses of new connections to it to all of the other connections
  // it already has.
 
  if(myMessageType === 'connect to this peer'){
    var peerAddress = myMessageArg;
    
    // Connect to the WebRTC peer that is also connected to the WebSocket peer
    var rtcPeer = webSocketPeer.to(peerAddress);
    
    // When the connection to the WebRTC peer opens, send a 'hello!' message.
    rtcPeer.on('open', function(){
      // Note that at this stage we're communicating directly with rtcPeer,
      // webSocketPeer is not involved in any way.
      rtcPeer.send('hello!');
    });
    
    rtcPeer.on('message', function(message){
      console.log(message);
    });
  }
});
```
## API

### `P.create()` returns `[root p instance]`
Creates an instance of p. Think of this as the root of all the connections you'll establish, or a node
within a network.

### `[root p instance].to(address)` returns `websocket p instance`
Establishes a connection to a WebSocket server. The `address` should be a WebSocket server address 
(e.g. ws://127.0.0.1:20500/).

### `[websocket p instance].to(address)` returns `webrtc p instance`
Establishes a connection to a WebRTC host using the WebSocket connection as the signaling channel.
The `address` is an identifier of a peer also connected to the WebSocket peer.

### `[webrtc p instance].to(address)` returns `webrtc p instance`
Establishes a connection to a WebRTC host using the WebRTC connection as the signaling channel.
The `address` is an identifier of a peer also connected to the WebRTC peer.

### `[p instance].send(arg1, arg2, ...)`
Send a JSON object or an ArrayBuffer to the peer. You can send 0 or more arguments to the peer.
The peer will be listening for this on the `message` event for JSON and `array buffer` for array buffers.

### `[p instance].on(event, callback)`
Listen for an event from the peer.

Possible events:

* `open` fires when the connection is established and ready
* `close` fires when the connection is closed
* `message` fires when there is a JSON message from the peer
* `array buffer` fires when there is an ArrayBuffer message from the peer
* `connection` fires when a new peer connection is established via the peer.

### `[p instance].removeListener(event, opt_callback)`
Remove a callback which was bound via `[p instance].on()`. If no callback is provided, all callbacks
for the event will be removed.

### `[p instance].close()`
Closes the connection to the peer

## Trying Out an Example

Prerequisites:

1. Node 0.10+
2. Chrome 26+

Running the example

1. Install onramp by executing `npm install -g onramp`
>    onramp is a simple WebSocket server which helps browsers 
that are connected to it connect to each other.

2. Start onramp by executing `onramp`
3. Install p-examples by executing `npm install -g p-examples`
>    p-examples is a basic HTTP server which runs the examples files on localhost:20501.

4. Start p-examples by executing `p-examples`
5. Start Chrome with the `--enable-data-channels` flag
6. Naviage a browser to [http://localhost:20501/ping-pong/ping.html](http://localhost:20501/examples/ping-pong/ping.html).
7. Naviage another browser to [http://localhost:20501/ping-pong/pong.html](http://localhost:20501/examples/ping-pong/pong.html).
>    If you don't have two machines, you can just use different tabs.

8. Open up your Chrome JavaScript Console

You should now see "I received: Pong!" and "I received: Ping?" in the console of ping.html and pong.html. 
This means your browser was able to establish an RTC connection to itself through onramp.
You can now shut down onramp and your connection between the two browsers will persist.

Take a look at [ping.js](https://github.com/oztu/p/blob/master/examples/ping-pong/ping.js) 
and [pong.js](https://github.com/oztu/p/blob/master/examples/ping-pong/pong.js), along with 
[onramp](https://github.com/oztu/onramp/blob/master/bin/onramp) to see how everything is wired up.

