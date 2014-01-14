# <a href="http://ozan.io/p">P</a> is for peer-to-peer networking with browsers

P is a small framework to create browser-to-browser networks (as opposed to just a connection).

With P, you can:
* Establish connections to other browsers using a WebSocket server.
* Establish connections to other browsers using connections you've established to other browsers.

After a connection is established the middleman is no longer nescessary – no proxies are involved.

This is made possible by an unstable and young technology -- [WebRTC](http://www.webrtc.org/). 
Currently, only Chrome and Firefox can establish the data channels between browsers that P relies on.

[onramp](https://github.com/oztu/onramp), a simple WebSocket server, is used as the signaling channel 
to establish initial connections.

## Documentation
* [Example with walkthrough](http://ozan.io/p/#walkthrough)
* [API](http://ozan.io/p/#use)
* [Cookbook](http://ozan.io/p/#cookbook)
* [Contribute](http://ozan.io/p/#contribute)

