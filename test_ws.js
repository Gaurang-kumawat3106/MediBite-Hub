const WebSocket = require('ws');

const ws = new WebSocket('wss://api.bhukkadbox.in/ws/orders/');

ws.on('open', function open() {
  console.log('Successfully connected to wss://api.bhukkadbox.in/ws/orders/');
  ws.close();
});

ws.on('error', function error(err) {
  console.log('Connection failed:', err.message);
});
