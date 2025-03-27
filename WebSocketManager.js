const { Notice } = require('obsidian');

class WebSocketManager {
    /** @param {string} url */
    /** @param {function(string): void} onMessage */
    /** @param {function(): void} onOpen */
    /** @param {function(number, string): void} onClose */
    /** @param {function(string): void} onError */
    constructor(url, onMessage, onOpen, onClose, onError) {
        this.url = url;
        this.ws = null;
        this.onMessage = onMessage;
        this.onOpen = onOpen;
        this.onClose = onClose;
        this.onError = onError;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000; // 5 seconds
        console.log("WebSocketManager: Initialized");
    }

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            console.log("WebSocketManager: Already connected or connecting.");
            return;
        }

        try {
            console.log(`WebSocketManager: Attempting to connect to ${this.url}...`);
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                console.log("WebSocketManager: Connection opened.");
                this.reconnectAttempts = 0; // Reset attempts on successful connection
                if (this.onOpen) this.onOpen();
            };

            this.ws.onmessage = (event) => {
                // console.log("WebSocketManager: Message received:", event.data); // Can be noisy
                if (this.onMessage) this.onMessage(event.data);
            };

            this.ws.onclose = (event) => {
                console.log(`WebSocketManager: Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
                if (this.onClose) this.onClose(event.code, event.reason);
                this.ws = null; // Clear reference
                // Attempt to reconnect if not closed intentionally (code 1000)
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    console.log(`WebSocketManager: Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
                    setTimeout(() => this.connect(), this.reconnectInterval);
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                     console.log("WebSocketManager: Max reconnect attempts reached.");
                     if (this.onError) this.onError("Max reconnect attempts reached.");
                }
            };

            this.ws.onerror = (error) => {
                console.error("WebSocketManager: Error occurred:", error);
                // The 'close' event will usually follow an error.
                // We can call onError here, but onClose might handle the state better.
                if (this.onError) this.onError(error.message || "Unknown WebSocket error");
                // Ensure ws is nullified if error occurs before open/close
                if (this.ws && this.ws.readyState !== WebSocket.OPEN && this.ws.readyState !== WebSocket.CONNECTING) {
                    this.ws = null;
                }
            };
        } catch (error) {
            console.error("WebSocketManager: Failed to create WebSocket instance:", error);
            if (this.onError) this.onError(`Failed to create WebSocket: ${error.message}`);
            this.ws = null;
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(message);
            return true;
        } else {
            console.log("WebSocketManager: Cannot send message, connection not open.");
            new Notice("Cannot send message: Not connected to server.");
            return false;
        }
    }

    close(code = 1000, reason = "Client closed connection") {
        if (this.ws) {
            console.log(`WebSocketManager: Closing connection intentionally (Code: ${code})`);
            // Prevent automatic reconnection for intentional close
            this.reconnectAttempts = this.maxReconnectAttempts;
            this.ws.close(code, reason);
            this.ws = null;
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    isConnecting() {
         return this.ws && this.ws.readyState === WebSocket.CONNECTING;
    }
}

module.exports = WebSocketManager;