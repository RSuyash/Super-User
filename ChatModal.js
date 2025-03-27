const { Modal, Notice, MarkdownRenderer, App } = require('obsidian');
const { renderMarkdownUtil, insertIntoEditorUtil, createNoteUtil, sanitizeFilenameUtil } = require('./utils');

const STYLES = `
/* Basic Modal Styling */
.chat-modal .modal { max-width: 700px; width: 95%; }
.chat-modal .modal-content { padding: 0; }
/* Chat Interface Styling */
.chat-container-modal { height: 550px; display: flex; flex-direction: column; background-color: var(--background-primary); }
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
/* Thinking Indicator */
.thinking-indicator { font-style: italic; color: var(--text-muted); padding: 5px 15px; text-align: right; height: 1.5em; }
`;

class ChatModal extends Modal {
    constructor(app, plugin) {
        super(app);
        this.plugin = plugin;
        this.searchResults = [];
        this.searchResultsEl = null;
        this.chatLogEl = null;
        this.inputEl = null;
        this.sendButtonEl = null;
        this.statusEl = null;
        this.isThinking = false;
        this.modalEl.addClass('chat-modal');
        console.log("ChatModal: Constructor called");
    }

    onOpen() {
        console.log("ChatModal: onOpen called");
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('style', { text: STYLES });

        const chatContainer = contentEl.createDiv({ cls: 'chat-container-modal' });
        const toolbar = chatContainer.createDiv({ cls: 'toolbar-modal' });
        const buttonGroupLeft = toolbar.createDiv();
        const buttonGroupRight = toolbar.createDiv();
        toolbar.style.justifyContent = 'space-between';
        buttonGroupLeft.createEl('button', { text: 'New Chat' }).addEventListener('click', () => this.clearChat(true));
        buttonGroupRight.createEl('button', { text: 'Create Note' }).addEventListener('click', () => this.createNoteFromChat());
        buttonGroupRight.createEl('button', { text: 'Export Chat' }).addEventListener('click', () => this.exportChat());

        this.chatLogEl = chatContainer.createDiv({ cls: 'chat-log-modal' });
        this.statusEl = chatContainer.createDiv({ cls: 'thinking-indicator' });
        const inputArea = chatContainer.createDiv({ cls: 'input-area-modal' });
        this.searchResultsEl = inputArea.createDiv({ cls: 'search-results-modal' });
        this.inputEl = inputArea.createEl('input', { cls: 'chat-input-modal', attr: { type: 'text', placeholder: 'Ask Gemini... (Type [[link, @tag, /cmd)' } });
        this.sendButtonEl = inputArea.createEl('button', { text: 'Send' });

        this.loadHistory();
        this.setupInputListeners();
        this.setThinking(false);
        this.inputEl.focus();
        console.log("ChatModal: onOpen finished");
    }

    setThinking(thinking) {
        this.isThinking = thinking;
        if (this.statusEl) {
            this.statusEl.textContent = thinking ? 'Gemini is thinking...' : '';
        }
        if (this.inputEl) this.inputEl.disabled = thinking;
        if (this.sendButtonEl) this.sendButtonEl.disabled = thinking;
        console.log(`ChatModal: setThinking(${thinking}), Input disabled: ${this.inputEl?.disabled}`);
    }

    setupInputListeners() {
        this.inputEl.addEventListener('keyup', (event) => {
            if (this.isThinking) return;
            if (event.key.length > 1 && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].contains(event.key)) return;
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

    async sendMessage() {
        if (this.isThinking) return;
        const message = this.inputEl.value.trim();
        if (!message) return;

        if (message.startsWith('/')) {
            this.handleCommand(message);
            this.inputEl.value = '';
            this.hideSearchResults();
            return;
        }

        this.displayMessage('User', message);
        this.inputEl.value = '';
        this.hideSearchResults();
        this.setThinking(true);

        const apiKey = this.plugin.settings.geminiApiKey;
        if (!apiKey) {
            this.displaySystemMessage("Error: Gemini API Key not set in plugin settings.");
            this.setThinking(false);
            return;
        }

        const modelName = this.plugin.settings.geminiModel || DEFAULT_SETTINGS.geminiModel;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        const activeFile = this.app.workspace.getActiveFile();
        const context = (this.plugin.settings.sendContext && activeFile) ? `[Obsidian Context: Current Note is "${activeFile.basename}"]\n` : '';
        const prefix = this.plugin.settings.promptPrefix ? `${this.plugin.settings.promptPrefix}\n` : '';
        const fullMessage = `${prefix}${context}${message}`;

        // Construct history for Gemini API (simple alternating user/model)
        const historyToSend = this.plugin.settings.chatHistory
            .filter(entry => entry.sender !== 'System')
            .map(entry => ({
                role: entry.sender === 'user' ? 'user' : 'model',
                parts: [{ text: entry.message }]
            }));

        const currentMessagePart = { text: fullMessage };
        const requestBody = { contents: [...historyToSend, { role: 'user', parts: [currentMessagePart] }] };

        console.log("[ChatModal sendMessage] Sending to Gemini:", JSON.stringify(requestBody, null, 2));

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: { message: `HTTP error! status: ${response.status}` } }));
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("[ChatModal sendMessage] Received from Gemini:", JSON.stringify(data, null, 2));

            // Extract text response - adjust based on actual Gemini API structure
            const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response text found.";
            this.displayMessage('Gemini', aiResponse);

        } catch (error) {
            console.error("ChatModal: Error calling Gemini API:", error);
            this.displaySystemMessage(`Error: ${error.message}`);
        } finally {
            this.setThinking(false); // Stop thinking indicator
        }
    }

    handleCommand(command) {
        console.log("ChatModal: Cmd:", command);
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');

        switch (cmd) {
            case '/clear':
                this.clearChat(true);
                break;
            case '/help':
                this.displaySystemMessage("Cmds: /clear, /help, /search <q>, /createNote <t>");
                break;
            case '/search':
                if (!args) {
                    this.displaySystemMessage("Usage: /search <query>"); return;
                }
                this.displaySystemMessage(`Searching: ${args}... (Not implemented)`);
                break;
            case '/createnote':
                if (!args) {
                    this.displaySystemMessage("Usage: /createNote <Title>"); return;
                }
                this.createNoteWithTitle(args);
                break;
            default:
                this.displaySystemMessage(`Unknown command: ${cmd}. Try /help.`);
        }
    }

    clearChat(clearHistory = false) {
        if (this.chatLogEl) this.chatLogEl.empty();
        this.displaySystemMessage("Chat cleared.");
        if (clearHistory) {
            this.plugin.settings.chatHistory = [];
            this.plugin.saveSettings();
            new Notice("History cleared.");
        }
    }

    async createNoteWithTitle(title) {
        const content = `## Chat Command: Create Note\n\nTitle: ${title}\n\n---\n\n`;
        const newFile = await createNoteUtil(title, content, this.plugin.settings.createNoteFolder, this.app);
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
        if (!query) {
            this.hideSearchResults();
            return;
        }
        const files = this.app.vault.getMarkdownFiles();
        this.searchResults = files
            .filter(file => file.basename.toLowerCase().includes(query))
            .slice(0, 5);
        this.displaySearchResults(this.searchResults, resultsContainer, (file) => `[[${file.basename}]]`);
    }

    async searchTags(query, resultsContainer) {
        if (!query) {
            this.hideSearchResults();
            return;
        }
        const allTags = Object.keys(this.app.metadataCache.getTags());
        this.searchResults = allTags
            .filter(tag => tag.toLowerCase().includes(query))
            .slice(0, 5);
        this.displaySearchResults(this.searchResults, resultsContainer, (tag) => tag);
    }

    displaySearchResults(results, container, formatResult) {
        container.empty();
        if (results.length === 0) {
            container.classList.remove('active');
            return;
        }
        results.forEach(result => {
            const item = container.createDiv({ cls: 'search-item-modal' });
            item.textContent = result.basename || result;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const input = this.contentEl.querySelector('.chat-input-modal');
                const text = input.value;
                const cursorPos = input.selectionStart;
                const beforeText = text.slice(0, cursorPos).replace(/(?:^|\s)(?:\[\[|@)[^\s]*$/, '');
                const afterText = text.slice(cursorPos);
                const formatted = formatResult(result);
                input.value = beforeText + formatted + ' ' + afterText;
                input.focus();
                const newCursorPos = beforeText.length + formatted.length + 1;
                input.setSelectionRange(newCursorPos, newCursorPos);
                this.hideSearchResults();
            });
        });
        container.classList.add('active');
    }

    async createNoteFromChat() {
        console.log("ChatModal: createNote");
        if (!this.chatLogEl) return;
        const messages = Array.from(this.chatLogEl.children)
                             .filter(el => !el.classList.contains('system-message-modal'))
                             .map(msg => msg.textContent || '');

        const fileName = `Chat-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const content = messages.join('\n\n');
        await createNoteUtil(fileName, content, this.plugin.settings.createNoteFolder, this.app);
        this.close();
    }

    async exportChat() {
        console.log("ChatModal: exportChat");
        if (!this.chatLogEl) return;
        const messages = Array.from(this.chatLogEl.children)
                             .filter(el => !el.classList.contains('system-message-modal'))
                             .map(msg => msg.textContent || '');

        const content = messages.join('\n\n');

        try {
            await navigator.clipboard.writeText(content);
            new Notice('Chat copied');
        } catch (error) {
             new Notice('Failed to copy chat');
             console.error('ChatModal: Failed copy:', error);
        }
    }

    displayMessage(sender, message) {
        if (!this.chatLogEl) return;
        const messageEl = this.chatLogEl.createDiv({ cls: 'message-modal' });
        const tempDiv = document.createElement('div');
        // Pass 'this' (ChatModal instance) as component context
        renderMarkdownUtil(`**${sender}:** ${message}`, tempDiv, this.app, this);
        messageEl.prepend(tempDiv);
        this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
    }

    displaySystemMessage(message) {
        if (!this.chatLogEl) return;
        const messageEl = this.chatLogEl.createDiv({ cls: 'message-modal system-message-modal' });
        messageEl.textContent = message;
        this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
    }

    onClose() {
        console.log("ChatModal: onClose");
        const { contentEl } = this;
        contentEl.empty();
    }
}

// --- Main Plugin Class ---
class WebappDashboardPlugin extends Plugin {
    settings = DEFAULT_SETTINGS;

    async onload() {
        console.log('[WebappDashboard] onload: Loading plugin...');
        try {
            await this.loadSettings();
            console.log('[WebappDashboard] onload: Settings loaded.');
        } catch (error) { console.error('[WebappDashboard] onload: Error loading settings:', error); }

        try {
            this.addSettingTab(new WebappDashboardSettingTab(this.app, this));
            console.log('[WebappDashboard] onload: Settings tab added.');
        } catch (error) { console.error('[WebappDashboard] onload: Error adding settings tab:', error); }

        try {
            this.addRibbonIcon('message-circle', 'Open Webapp Chat', () => {
                console.log('[WebappDashboard] Ribbon icon clicked');
                try { new ChatModal(this.app, this).open(); }
                catch (e) { console.error("Err opening modal (ribbon):", e); new Notice("Failed to open chat modal."); }
            });
            console.log('[WebappDashboard] onload: Ribbon icon added.');
        } catch (error) { console.error('[WebappDashboard] onload: Error adding ribbon icon:', error); }

        try {
            this.addCommand({
                id: 'open-webapp-dashboard-chat', name: 'Open Webapp Chat',
                hotkeys: [{ modifiers: ["Mod", "Shift"], key: "C" }],
                callback: () => {
                    console.log('[WebappDashboard] Command executed');
                    try { new ChatModal(this.app, this).open(); }
                    catch (e) { console.error("Err opening modal (cmd):", e); new Notice("Failed to open chat modal."); }
                }
            });
            console.log('[WebappDashboard] onload: Command added.');
        } catch (error) { console.error('[WebappDashboard] onload: Error adding command:', error); }

        this.registerEvent(this.app.workspace.on('webapp-dashboard:clear-history', () => {
            console.log('[WebappDashboard] clear-history event');
            this.app.workspace.getLeavesOfType('modal').forEach(leaf => {
                if (leaf.view instanceof Modal && leaf.view.constructor.name === 'ChatModal') {
                     try { if(leaf.view.loadHistory) leaf.view.loadHistory(); } catch (e) { console.error("Error reloading history on modal:", e); }
                }
            });
        }));
        console.log('[WebappDashboard] onload: Event listener registered.');

        console.log('[WebappDashboard] onload: Finished.');
    }

    onunload() { console.log('[WebappDashboard] onunload: Unloading plugin...'); }
    async loadSettings() { try { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); if (!Array.isArray(this.settings.chatHistory)) this.settings.chatHistory = []; if (this.settings.maxHistoryLength > 0 && this.settings.chatHistory.length > this.settings.maxHistoryLength) { this.settings.chatHistory = this.settings.chatHistory.slice(-this.settings.maxHistoryLength); } console.log('[WebappDashboard] loadSettings: Success.'); } catch (error) { console.error('[WebappDashboard] loadSettings: Error:', error); this.settings = DEFAULT_SETTINGS; } }
	async saveSettings() { try { await this.saveData(this.settings); console.log('[WebappDashboard] saveSettings: Success.'); } catch (error) { console.error('[WebappDashboard] saveSettings: Error:', error); new Notice("Failed to save settings."); } }
}