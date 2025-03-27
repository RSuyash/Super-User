const WebSocket = require('ws');

console.log('Starting WebSocket server...');

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        console.log('Received:', message.toString());
        // Echo back the message
        ws.send(`Server received: ${message}`);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    // Send welcome message
    ws.send('Connected to WebSocket server');
});

wss.on('listening', () => {
    console.log('WebSocket server is listening on port 8080');
});

wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
});