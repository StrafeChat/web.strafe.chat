const WebSocket = require('ws');
const msgpack = require('msgpack-lite');

console.log('Testing WebSocket connection to Stargate...');

const ws = new WebSocket('ws://localhost:8080/events');

ws.on('open', function open() {
  console.log('Connected to WebSocket');
  
  // Send authentication
  const authPayload = {
    op: 'IDENTIFY',
    d: {
      token: 'your_token_here' // Replace with actual token
    }
  };
  
  const encoded = msgpack.encode(authPayload);
  ws.send(encoded);
  console.log('Sent auth payload');
});

ws.on('message', function message(data) {
  try {
    const decoded = msgpack.decode(data);
    console.log('Received message:', JSON.stringify(decoded, null, 2));
    
    // Check for MESSAGE_CREATE events specifically
    if (decoded.op === 'MESSAGE' && decoded.d) {
      console.log('MESSAGE event details:');
      console.log('- type:', decoded.d.type);
      console.log('- event_type:', decoded.d.event_type);
      console.log('- data:', decoded.d.data);
      
      if (decoded.d.data) {
        console.log('Message data details:');
        console.log('- type:', decoded.d.data.type);
        console.log('- system_type:', decoded.d.data.system_type);
        console.log('- author_id:', decoded.d.data.author_id);
        console.log('- content:', decoded.d.data.content);
      }
    }
  } catch (error) {
    console.error('Error decoding message:', error);
    console.log('Raw data:', data);
  }
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('WebSocket connection closed');
});

// Keep the script running
setTimeout(() => {
  console.log('Test completed');
  process.exit(0);
}, 30000); // Run for 30 seconds