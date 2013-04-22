var socket = require('./SocketConnection.js').create;
var Anarch = require('./Anarch.js');

a = Anarch.create();
b = Anarch.create();
c = Anarch.create();



// IMPLEMENT RELAY MECHANISM FOR CLIENT SIDE



a1 = a.to('ws://192.168.0.101:20500/');
b1 = b.to('ws://192.168.0.101:20500/').on('remote address', function(address){
	var b1a = b1.to(address).on('open', function(){
		b1a.send('FROM B');
	});
});

c1 = c.to('ws://192.168.0.101:20500/').on('connection', function(connection){
	console.log("Connection to C");
	connection.on('json', function(){
		console.log('JSON!', arguments);
	});
	connection.on('remote address', function(address){
		console.warn("C trying to connect to", address);
		connection.to(address).on('open', function(){
			console.log("HIIIT");
		});
	});
});

/*
c = socket('ws://192.168.0.101:20500/').on('connection', function(connection){
		console.warn('Connection', connection);
		connection.on('open', function(){
			connection.send("C HERE");
		});
	});

/*
var bytearray = new Uint8Array(10);
for(var i = 0; i < 10; i++){
	bytearray[i] = i;
}

anarch.to('ws://192.168.0.101:20500/').send({
	connectTo: "ozan"
});

anarch.on('connection request', function(data){
	data.iceDesc;
	data.
});

anarch.at('ws://192.168.0.101:20500/').connect()

anarch.at('ws://192.168.0.101:20500/').send(["connect as", "ozan"]);
anarch.at('ws://192.168.0.101:20500/').send(["connect to", "ozan"]);
anarch.handler(function(){});
anarch.join('ws://192.168.0.101:20500/', {name: "ozan"}).send({})

anarch.at();
anarch.send();
anarch.receive(function(message){

});

anarch.to('ws://192.168.0.101:20500/').to('ozan').send();
anarch.on("message", function(message){

});

anarch.on('connection request', function(request){
	request.approve();
});

var wsAnarch = anarch.to("ws://192.168.0.101:20500/");
wsAnarch.send(bytearray);
wsAnarch.send(new Uint8Array(10000));

wsAnarch.to("ozan")

/*
var socket = Socket.create({address: "ws://192.168.0.101:20500/"});

socket.on("open", function(){
	var bytearray = new Uint8Array(10);
	for(var i = 0; i < 10; i++){
		bytearray[i] = i;
	}

	socket.send(bytearray.buffer); 
});
*/
/*
var a = Connection.create();
var b = Connection.create();
window.a = a;
window.b = b;

a.on("ice candidate", function(){
	if (event.candidate) {
		//b.connection.addIceCandidate(event.candidate);
		console.log('Local ICE candidate: \n' + event.candidate.candidate);
	}
});

b.on("ice candidate", function(){
	if (event.candidate) {
		a.connection.addIceCandidate(event.candidate);
		console.log('Local ICE candidate: \n' + event.candidate.candidate);
	}
});

b.on("data channel", function(channel){
	console.log("data channel", arguments);

	channel.on("open", function(){
		console.log("remote channel open", arguments);
	});

	channel.on("close", function(){
		console.log("remote channel close", arguments);
	});

	channel.on("message", function(){
		console.log("remote channel message", arguments);
	});
});

/*var channel = a.createDataChannel("data", {reliable:false});
window.channel = channel;
channel.on("open", function(){
	console.log("channel open", arguments);
});

channel.on("close", function(){
	console.log("channel close", arguments);
});

console.log("CREATE OFFER!")
a.connection.createOffer(function(desc){
	console.log("OFFER!")
	a.connection.setLocalDescription(desc);
	b.connection.setRemoteDescription(desc);
	b.connection.createAnswer(function(desc){
		console.log("ANSWER!");
		b.connection.setLocalDescription(desc);
		a.connection.setRemoteDescription(desc);
	});
});
*/