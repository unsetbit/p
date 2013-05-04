# p

p allows you to connect one browser to another. It uses [onramp](https://github.com/oztu/onramp) as the signaling
channel to establish the connections.

p relies on very young technology -- [WebRTC](http://www.webrtc.org/). Currently, only Chrome has the 
ability to establish the P2P data channels between browsers that p uses.

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

## Trying the example

Prerequisites:

1. Node 0.10+
2. Chrome 26+
3. grunt-cli (execute `npm install grunt-cli -g`)
4. bower (execute `npm install bower -g`)
5. onramp (execute `npm install onramp -g`)

Running the example

1. Clone this repo (execute `git clone https://github.com/oztu/p`)
2. Go in to the directory (execute `cd p`)
3. Start the dev server (execute `grunt dev`)
4. Start onramp (exectue `onramp`)
5. Start Chrome with the `--enable-data-channels` flag
6. Go to [http://localhost/examples/ping-pong/ping.html](http://localhost/examples/ping-pong/ping.html)
7. Go to [http://localhost/examples/ping-pong/pong.html](http://localhost/examples/ping-pong/pong.html)
8. Open up your dev console and note the messages you're receiving directly from the other browser

You should now see "Got: Ping?" and "Got: Pong!" in alternating order. This means your browser was able to establish an
RTC connection to itself through onramp. You can now shut down onramp and your connection between the two browsers
(in this case, the same one) will still persist.

Take a look at [ping.js](https://github.com/oztu/p/blob/master/examples/ping-pong/ping.js) 
and [pong.js](https://github.com/oztu/p/blob/master/examples/ping-pong/pong.js), along with 
[onramp](https://github.com/oztu/onramp/blob/master/bin/onramp) to see how everything is wired up.

