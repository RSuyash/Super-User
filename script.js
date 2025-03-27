document.addEventListener('DOMContentLoaded', () => {
    const chatLog = document.getElementById('chat-log');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');

    const websocket = new WebSocket('ws://localhost:8080');

    websocket.onopen = () => {
        console.log('WebSocket connection established');
    };

    websocket.onmessage = (event) => {
        displayMessage('Server', event.data);
    };

    websocket.onclose = () => {
        console.log('WebSocket connection closed');
    };

    websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    sendButton.addEventListener('click', sendMessage);

    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    });

    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            displayMessage('User', message);
            websocket.send(message); // Send message to WebSocket server
            chatInput.value = '';
        }
    }

    function displayMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatLog.appendChild(messageElement);
        chatLog.scrollTop = chatLog.scrollHeight; // Scroll to bottom
    }
});