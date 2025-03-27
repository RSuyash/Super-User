const { Modal, Notice, App } = require('obsidian');
const WebSocketManager = require('./WebSocketManager');
const { renderMarkdown, insertIntoEditor, createNote } = require('./utils');

const STYLES = `
/* Basic Modal Styling */
.chat-modal .modal { max-width: 600px; width: 90%; }
.chat-modal .modal-content { padding: 0; }
/* Chat Interface Styling */
.chat-container-modal { height: 500px; display: flex; flex-direction: column; background-color: var(--background-primary); }
.chat-log-modal { flex-grow: 1; padding: 15px; overflow-y: scroll; border-bottom: 1px solid var(--background-modifier-border); }
.input-area-modal { padding: 10px 15px; display: flex; gap: 8px; border-top: 1px solid var(--background-modifier-border); position: relative; }
.chat-input-modal { flex-grow: 1; padding: 8px; }
.message-modal { margin-bottom: 10px; padding: 8px 12px; border-radius: 6px; background-color: var(--background-secondary); word-wrap: break-word; position: relative; }
.message-modal:hover .insert-button { display: inline-block; }
.system-message-modal { color: var(--text-muted); font-style: italic; text-align: center; padding: 5px 0; }
.toolbar-modal { padding: 8px 15px; display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px solid var(--background-modifier-border); background-color: var(--background-secondary-alt); }
.toolbar-modal button { padding: 4px 8px; }
.insert-button { position: absolute; right: 5px; top: 5px; font-size: 0.8em; cursor: pointer; display: none; padding: 2px 4px; background-color: var(--background-modifier-hover); border: 1px solid var(--background-modifier-border); border-radius: 3px; }
/* Search Results Styling */
.search-results-modal { position: absolute; bottom: calc(100% + 5px); left: 15px; right: 15px; max-height: 200px; overflow-y: auto; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 4px; display: none; z-index: 1001; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.search-results-modal.active { display: block; }
.search-item-modal { padding: 8px 12px; cursor: pointer; }
.search-item-modal:hover { background: var(--background-modifier-hover); }
/* Connection Status */
.connection-status { font-size: 0.8em; padding: 0 15px 5px; text-align: right; }
.connection-status.connected { color: var(--color-green); }
.connection-status.disconnected { color: var(--color-red); }
.connection-status.connecting { color: var(--text-muted); }
`;

class ChatModal extends Modal {
    /** @param {App} app */
    /** @param {import('./main').WebappDashboardPlugin} plugin */
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.wsManager = null;
        this.searchResults = [];
        this.searchResultsEl = null;
        this.chatLogEl = null;
        this.inputEl = null;
        this.sendButtonEl = null;
        this.statusEl = null; // For connection status
        this.modalEl.addClass('chat-modal');
        console.log("ChatModal: Constructor called");
    }

    onOpen() {
        console.log("ChatModal: onOpen called");
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('style', { text: STYLES });

        const chatContainer = contentEl.createDiv({ cls: 'chat-container-modal' });

        // Toolbar
        const toolbar = chatContainer.createDiv({ cls: 'toolbar-modal' });
        const buttonGroupLeft = toolbar.createDiv({ cls: 'toolbar-button-group-left' }); // Group for future buttons
        const buttonGroupRight = toolbar.createDiv({ cls: 'toolbar-button-group-right' });

        const newConvBtn = buttonGroupLeft.createEl('button', { text: 'New Chat' });
        newConvBtn.addEventListener('click', () => this.clearChat());

        const createNoteBtn = buttonGroupRight.createEl('button', { text: 'Create Note' });
        createNoteBtn.addEventListener('click', () => this.createNoteFromChat());
        const exportBtn = buttonGroupRight.createEl('button', { text: 'Export Chat' });
        exportBtn.addEventListener('click', () => this.exportChat());

        // Chat Log
        this.chatLogEl = chatContainer.createDiv({ cls: 'chat-log-modal' });

        // Connection Status
        this.statusEl = chatContainer.createDiv({ cls: 'connection-status connecting', text: 'Connecting...' });

        // Input Area
        const inputArea = chatContainer.createDiv({ cls: 'input-area-modal' });
        this.searchResultsEl = inputArea.createDiv({ cls: 'search-results-modal' });
        this.inputEl = inputArea.createEl('input', {
            cls: 'chat-input-modal',
            attr: { type: 'text', placeholder: 'Type [[link, @tag, /cmd...' }
        });
        this.sendButtonEl = inputArea.createEl('button', { text: 'Send' });

        this.loadHistory();
        this.setupWebSocket();
        this.setupInputListeners();

        this.sendButtonEl.disabled = true;
        this.inputEl.disabled = true;
        this.inputEl.focus();
        console.log("ChatModal: onOpen finished");
    }

    setupWebSocket() {
        const url = this.plugin.settings.websocketUrl;
        this.wsManager = new WebSocketManager(
            url,
            (message) => this.displayMessage('Server', message), // onMessage
            () => { // onOpen
                this.displaySystemMessage('Connected to server');
                this.updateStatus('connected');
                this.sendButtonEl.disabled = false;
                this.inputEl.disabled = false;
            },
            (code, reason) => { // onClose
                this.displaySystemMessage(`Disconnected (Code: ${code})`);
                this.updateStatus('disconnected');
                this.sendButtonEl.disabled = true;
                this.inputEl.disabled = true;
            },
            (errorMsg) => { // onError
                this.displaySystemMessage(`Connection Error: ${errorMsg}`);
                this.updateStatus('disconnected');
                this.sendButtonEl.disabled = true;
                this.inputEl.disabled = true;
            }
        );
        this.wsManager.connect();
    }

     updateStatus(status) {
        if (!this.statusEl) return;
        this.statusEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        this.statusEl.className = `connection-status ${status}`; // Update class for styling
    }

    setupInputListeners() {
        this.inputEl.addEventListener('keyup', (event) => {
            if (event.key.length > 1 && event.key !== 'Backspace' && event.key !== 'Delete') return;
            const text = this.inputEl.value;
            const cursorPos = this.inputEl.selectionStart;
            const wikiLinkMatch = text.slice(0, cursorPos).match(/(?:^|\s)\[\[([^\]]*)$/);
            const mentionMatch = text.slice(0, cursorPos).match(/(?:^|\s)@([^\s]*)$/);

            if (wikiLinkMatch) {
                this.searchNotes(wikiLinkMatch[1].toLowerCase(), this.searchResultsEl);
            } else if (mentionMatch) {
                this.searchTags(mentionMatch[1].toLowerCase(), this.searchResultsEl);
            } else {
                this.hideSearchResults();
            }
        });

        this.inputEl.addEventListener('blur', () => {
            setTimeout(() => {
                if (this.searchResultsEl && !this.searchResultsEl.contains(document.activeElement)) {
                    this.hideSearchResults();
                }
            }, 150);
        });

        this.sendButtonEl.addEventListener('click', () => this.sendMessage());
        this.inputEl.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.sendMessage();
            }
        });
    }

    sendMessage() {
        const message = this.inputEl.value.trim();
        if (!message) return;

        if (message.startsWith('/')) {
            this.handleCommand(message);
            this.inputEl.value = '';
            this.hideSearchResults();
            return;
        }

        if (this.wsManager && this.wsManager.isConnected()) {
            this.displayMessage('User', message); // Display user message

            const activeFile = this.app.workspace.getActiveFile();
            const context = (this.plugin.settings.sendContext && activeFile) ? `[Context: ${activeFile.basename}] ` : '';
            const prefix = this.plugin.settings.promptPrefix ? `${this.plugin.settings.promptPrefix}\n` : '';
            const fullMessage = `${prefix}${context}${message}`;

            this.wsManager.send(fullMessage);
            this.inputEl.value = '';
            this.hideSearchResults();
        } else {
             this.displaySystemMessage("Cannot send message: Not connected.");
        }
    }

    handleCommand(command) {
        console.log("ChatModal: Handling command:", command);
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');

        switch (cmd) {
            case '/clear':
                this.clearChat(true); // Clear visually and history
                break;
            case '/help':
                this.displaySystemMessage("Available commands: /clear, /help, /search <query>, /createNote <title>");
                break;
            case '/search':
                if (!args) {
                    this.displaySystemMessage("Usage: /search <query>"); return;
                }
                this.displaySystemMessage(`Searching vault for: ${args}... (Not implemented yet)`);
                // TODO: Implement vault search integration
                break;
            case '/createnote':
                if (!args) {
                    this.displaySystemMessage("Usage: /createNote <Note Title>"); return;
                }
                this.createNoteWithTitle(args);
                break;
            default:
                this.displaySystemMessage(`Unknown command: ${cmd}. Type /help for available commands.`);
        }
    }

    clearChat(clearHistory = false) {
        if (this.chatLogEl) this.chatLogEl.empty();
        this.displaySystemMessage("Chat cleared.");
        if (clearHistory) {
            this.plugin.settings.chatHistory = [];
            this.plugin.saveSettings();
            new Notice("Chat history cleared.");
        }
    }

    async createNoteWithTitle(title) {
        const content = `## Chat Command: Create Note\n\nTitle: ${title}\n\n---\n\n`; // Basic content
        const newFile = await createNote(title, content, this.plugin.settings.createNoteFolder, this.app);
        if (newFile) {
            this.app.workspace.getLeaf(true).openFile(newFile);
            this.close();
        }
    }

    hideSearchResults() {
        if (this.searchResultsEl) {
            this.searchResultsEl.classList.remove('active');
            this.searchResultsEl.empty();
        }
    }

    async searchNotes(query, resultsContainer) {
         if (!query) { this.hideSearchResults(); return; }
        const files = this.app.vault.getMarkdownFiles();
        this.searchResults = files.filter(f => f.basename.toLowerCase().includes(query)).slice(0, 5);
        this.displaySearchResults(this.searchResults, resultsContainer, (file) => `[[${file.basename}]]`);
    }

    async searchTags(query, resultsContainer) {
         if (!query) { this.hideSearchResults(); return; }
        const allTags = Object.keys(this.app.metadataCache.getTags());
        this.searchResults = allTags.filter(t => t.toLowerCase().includes(query)).slice(0, 5);
        this.displaySearchResults(this.searchResults, resultsContainer, (tag) => tag);
    }

    displaySearchResults(results, container, formatResult) {
         container.empty();
        if (results.length === 0) { container.classList.remove('active'); return; }
        results.forEach(result => {
            const item = container.createDiv({ cls: 'search-item-modal' });
            item.textContent = result.basename || result;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const text = this.inputEl.value;
                const cursorPos = this.inputEl.selectionStart;
                const beforeText = text.slice(0, cursorPos).replace(/(?:^|\s)(?:\[\[|@)[^\s]*$/, '');
                const afterText = text.slice(cursorPos);
                const formatted = formatResult(result);
                this.inputEl.value = beforeText + formatted + ' ' + afterText;
                this.inputEl.focus();
                const newCursorPos = beforeText.length + formatted.length + 1;
                this.inputEl.setSelectionRange(newCursorPos, newCursorPos);
                this.hideSearchResults();
            });
        });
        container.classList.add('active');
    }

    async createNoteFromChat() {
         console.log("ChatModal: createNoteFromChat called");
        if (!this.chatLogEl) return;
        const messages = Array.from(this.chatLogEl.children)
                             .filter(el => !el.classList.contains('system-message-modal'))
                             .map(msg => msg.textContent || '');

        const fileName = `Chat-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const content = messages.join('\n\n');
        await createNote(fileName, content, this.plugin.settings.createNoteFolder, this.app);
        this.close();
    }

    async exportChat() {
         console.log("ChatModal: exportChat called");
         if (!this.chatLogEl) return;
        const messages = Array.from(this.chatLogEl.children)
                             .filter(el => !el.classList.contains('system-message-modal'))
                             .map(msg => msg.textContent || '');
        const content = messages.join('\n\n');
        try {
            await navigator.clipboard.writeText(content);
            new Notice('Chat copied to clipboard');
        } catch (error) {
             new Notice('Failed to copy chat to clipboard');
             console.error('ChatModal: Failed to copy chat:', error);
        }
    }

    displayMessage(sender, message) {
        if (!this.chatLogEl) return;
        const messageEl = this.chatLogEl.createDiv({ cls: 'message-modal' });
        const tempDiv = document.createElement('div');

        if (sender === 'Server') {
            const insertBtn = messageEl.createEl('button', { cls: 'insert-button', text: 'Insert' });
            insertBtn.addEventListener('click', () => {
                const template = this.plugin.settings.insertTemplate || '{response}';
                insertIntoEditor(template.replace('{response}', message), this.app);
            });
        }

        renderMarkdown(`**${sender}:** ${message}`, tempDiv, this.app, this);
        messageEl.prepend(tempDiv);
        this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;

        // Save to history only if it's not a system message
        if (sender !== 'System') {
            this.plugin.settings.chatHistory.push({ sender, message });
            while (this.plugin.settings.chatHistory.length > this.plugin.settings.maxHistoryLength) {
                this.plugin.settings.chatHistory.shift();
            }
            this.plugin.saveSettings();
        }
    }

    insertIntoEditor(text) {
        insertIntoEditor(text, this.app); // Use utility function
    }

    displaySystemMessage(message) {
        if (!this.chatLogEl) return;
        const messageEl = this.chatLogEl.createDiv({ cls: 'message-modal system-message-modal' });
        messageEl.textContent = message;
        this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
        // Do not save system messages to history
    }

    loadHistory() {
        if (!this.chatLogEl) return;
        this.chatLogEl.empty();
        this.plugin.settings.chatHistory.forEach(entry => {
            // Rerender history messages
            if (entry.sender === 'System') { // Check if it's a system message
                 this.displaySystemMessage(entry.message);
            } else {
                 this.displayMessage(entry.sender, entry.message);
            }
        });
         console.log(`ChatModal: Loaded ${this.plugin.settings.chatHistory.length} messages from history.`);
    }

    onClose() {
        console.log("ChatModal: onClose called");
        if (this.wsManager) {
            this.wsManager.close(); // Use manager's close method
            this.wsManager = null;
        }
        const { contentEl } = this;
        contentEl.empty();
    }
}

module.exports = { ChatModal }; // Export ChatModal