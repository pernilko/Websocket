'use strict';

const net = require('net');

//https://tools.ietf.org/html/rfc6455#section-10.8 -- documentation
// Simple HTTP server responds with a simple WebSocket client test
const httpServer = net.createServer(connection => {
    connection.on('data', () => {
        let content = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
     h1 {background-color: powderblue}
    </style>
  </head>
  <body>
 
    <div align="center">
        <h1>Websocket øving :)</h1>
    </div>
    <div align="center">
        <p>Skriv inn brukernavn: </p>
        <input id="username" value="Anonym"/>
        <p>Her kan du skrive inn en melding: </p>
        <input id="inputMessage" />
        <button type="button" onclick="send()">Send</button></br>
        <br/>
        <canvas hidden="true"></canvas>
    </div>
    <div id="message-board" align="center">
    <h3>Message board: </h3>
    <p id="message"></p>
    </div>
    <script>
      let ws = new WebSocket('ws://localhost:3001');
       ws.onopen = () => ws.send('hello');
       let messages = "";
      
       let send = () => {
          let message = document.getElementById("inputMessage").value;
          let username = document.getElementById("username").value;
          let jsonMessage = {
              "username": username,
              "message":message
          };
          
          messages += username + ": " + message+ "</br>";
          document.getElementById("message").innerHTML = messages;
          ws.send(JSON.stringify(jsonMessage));
          document.getElementById("inputMessage").value = "";
          
      };
      
      ws.onmessage = event => {
          let jsonMessage = JSON.parse(event.data);
          let messageElement = jsonMessage["username"] + ": " + jsonMessage["message"] + "</br>";
        
         messages += messageElement;
         document.getElementById("message").innerHTML=messages; 
         alert('Message from server: ' + event.data);
      };
    </script>
  </body>
</html>
`;
        connection.write('HTTP/1.1 200 OK\r\nContent-Length: ' + content.length + '\r\n\r\n' + content);
    });
});
httpServer.listen(3000, () => {
    console.log('HTTP server listening on port 3000');
});

function dec2hexString(dec) {
    return "0x" + (dec+0x10000).toString(16).substr(-4).toUpperCase();
}

const clients = new Set();

const makeMessage = (message) => {
    let buffer_1 = new Buffer([0x81]);
    let buffer_2 = new Buffer([dec2hexString(message.length)]);
    let buffer_3 = Buffer.from(message);
    return Buffer.concat([buffer_1,buffer_2,buffer_3]);
};

clients.brodcast = function (data, e) {
    for(let socket of this){
        if(socket !== e){
            socket.write(makeMessage(data));
        }
    }
};

const Createhandshake = (data) => {
    let globallyUniqueIdentifier = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

    //Finding sec key from header (line number 12)
    let response = data.toString().split("\n");
    let line = response[12].split(" ");
    console.log(line);
    let secKey = line[1].slice(0,-1);
    console.log(secKey);

    //Combining sec key with globally unique identifier
    let sec = secKey + globallyUniqueIdentifier;
    console.log(sec);

    //hashing sec with SHA1, and creating handshake
    let hash = require("crypto").createHash("SHA1").update(sec).digest("base64");
    let handshake = "HTTP/1.1 101 Switching Protocols\r\n" + "Upgrade: websocket\r\n" + "Connection: Upgrade\r\n" + "Sec-WebSocket-Accept: " + hash + "\r\n" + "\r\n";
    return handshake;
};

// Incomplete WebSocket server
const wsServer = net.createServer(connection => {
    console.log('Client connected');

    connection.on('data', data => {
       if(!(clients.has(connection))){
           console.log("Sending handshake");
           let handshake = Createhandshake(data);
           connection.write(handshake);
           clients.add(connection);
       }else{
           let bytes = Buffer.from(data);
           let length = bytes[1] & 127;
           let mStart = 2;
           let dStart = mStart + 4;
           let message = "";
           for (let i = dStart; i < dStart + length; i++) {
               let byte = bytes[i]^bytes[mStart + ((i - dStart) % 4)];
               message += String.fromCharCode(byte);
           }
           clients.brodcast(message, connection);
       }
    });

    connection.on('end', () => {
        clients.delete(connection);
        console.log('Client disconnected');
    });
});
wsServer.on('error', error => {
    console.error('Error: ', error);
});
wsServer.listen(3001, () => {
    console.log('WebSocket server listening on port 3001');
});