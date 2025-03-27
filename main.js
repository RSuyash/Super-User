const { Plugin, Modal, MarkdownRenderer, Notice, App, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } = require('obsidian');

// --- Default Settings ---
const DEFAULT_SETTINGS = {
    websocketUrl: 'ws://localhost:8080', // Kept for potential future fallback/testing
    promptPrefix: '',
    sendContext: true,
    maxHistoryLength: 100,
    createNoteFolder: '',
    insertTemplate: '> {response}',
    chatHistory: [],
    geminiApiKey: '', // Added for Direct Gemini
    geminiModel: 'gemini-pro' // Added for Direct Gemini
};

// --- Styles ---
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
/* Connection Status (Placeholder - will be removed for direct API) */
.connection-status { display: none; /* Hide WS status */ }
/* Thinking Indicator */
.thinking-indicator { font-style: italic; color: var(--text-muted); padding: 5px 15px; text-align: right; height: 1.5em; /* Reserve space */ }
`;

// --- Utility Functions ---
function renderMarkdownUtil(markdownText, targetEl, app, component) { const sourcePath = app.workspace.getActiveFile()?.path || ''; MarkdownRenderer.renderMarkdown(markdownText, targetEl, sourcePath, component); }
function insertIntoEditorUtil(text, app) { const editor = app.workspace.getActiveEditor?.editor; if (editor) { editor.replaceSelection(text); new Notice('Inserted'); } else { new Notice('No active editor'); } }
function sanitizeFilenameUtil(name) { return name.replace(/[\\/:*?"<>|]/g, '-'); }
async function createNoteUtil(title, content, folderPath, app) { const sanitizedTitle = sanitizeFilenameUtil(title); const cleanFolderPath = folderPath ? folderPath.trim().replace(/\\/g, '/').replace(/\/$/, '') : ''; const fullPath = cleanFolderPath ? `${cleanFolderPath}/${sanitizedTitle}.md` : `${sanitizedTitle}.md`; try { if (cleanFolderPath && !(await app.vault.adapter.exists(cleanFolderPath))) { await app.vault.createFolder(cleanFolderPath); console.log(`Utils: Created folder: ${cleanFolderPath}`); } let finalPath = fullPath; let counter = 1; while (await app.vault.adapter.exists(finalPath)) { finalPath = cleanFolderPath ? `${cleanFolderPath}/${sanitizedTitle}-${counter}.md` : `${sanitizedTitle}-${counter}.md`; counter++; } const newFile = await app.vault.create(finalPath, content); new Notice(`Note created: ${newFile.basename}`); return newFile; } catch (error) { new Notice(`Failed to create note: ${error.message}`); console.error('Utils: Failed to create note:', error); return null; } }

// --- WebSocket Manager ---
// Removed as we are using direct API calls

// --- Settings Tab ---
class WebappDashboardSettingTab extends PluginSettingTab {
	constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
	display() { const {containerEl} = this; containerEl.empty(); containerEl.createEl('h2', {text: 'Webapp Dashboard Settings'}); containerEl.createEl('h3', { text: 'Gemini API' }); new Setting(containerEl).setName('Gemini API Key').setDesc('Your Google AI Gemini API Key. Stored locally.').addText(t => t.setPlaceholder('Enter API Key').setValue(this.plugin.settings.geminiApiKey).onChange(async (v) => { this.plugin.settings.geminiApiKey = v.trim(); await this.plugin.saveSettings(); })); new Setting(containerEl).setName('Gemini Model').setDesc('Select model.').addDropdown(d => d.addOption('gemini-pro', 'Gemini Pro').addOption('gemini-1.5-flash-latest', 'Gemini 1.5 Flash').addOption('gemini-1.5-pro-latest', 'Gemini 1.5 Pro').setValue(this.plugin.settings.geminiModel || DEFAULT_SETTINGS.geminiModel).onChange(async (v) => { this.plugin.settings.geminiModel = v; await this.plugin.saveSettings(); })); containerEl.createEl('h3', { text: 'Chat Behavior' }); new Setting(containerEl).setName('Prompt Prefix').setDesc('Prepend text to messages.').addTextArea(t => t.setPlaceholder('e.g., Act as...').setValue(this.plugin.settings.promptPrefix).onChange(async (v) => { this.plugin.settings.promptPrefix = v; await this.plugin.saveSettings(); })); new Setting(containerEl).setName('Send Context').setDesc('Include active note name.').addToggle(t => t.setValue(this.plugin.settings.sendContext).onChange(async (v) => { this.plugin.settings.sendContext = v; await this.plugin.saveSettings(); })); new Setting(containerEl).setName('Insert Template').setDesc('Template for inserting responses ({response}).').addText(t => t.setPlaceholder(DEFAULT_SETTINGS.insertTemplate).setValue(this.plugin.settings.insertTemplate).onChange(async (v) => { this.plugin.settings.insertTemplate = v || DEFAULT_SETTINGS.insertTemplate; await this.plugin.saveSettings(); })); containerEl.createEl('h3', { text: 'History & Export' }); new Setting(containerEl).setName('Max History').setDesc('Messages to keep (0 for unlimited).').addText(t => t.setPlaceholder(String(DEFAULT_SETTINGS.maxHistoryLength)).setValue(String(this.plugin.settings.maxHistoryLength)).onChange(async (v) => { const n = parseInt(v, 10); this.plugin.settings.maxHistoryLength = (isNaN(n) || n < 0) ? DEFAULT_SETTINGS.maxHistoryLength : n; if (this.plugin.settings.chatHistory.length > this.plugin.settings.maxHistoryLength) { this.plugin.settings.chatHistory = this.plugin.settings.chatHistory.slice(-this.plugin.settings.maxHistoryLength); } await this.plugin.saveSettings(); })); new Setting(containerEl).setName('Note Folder').setDesc('Folder for created notes (blank for root).').addText(t => t.setPlaceholder('e.g., Chats/').setValue(this.plugin.settings.createNoteFolder).onChange(async (v) => { this.plugin.settings.createNoteFolder = v.trim().replace(/\\/g, '/').replace(/\/$/, ''); await this.plugin.saveSettings(); })); new Setting(containerEl).setName('Clear History').setDesc('Delete saved chat history.').addButton(b => b.setButtonText('Clear').setWarning().onClick(async () => { if (confirm('Clear chat history?')) { this.plugin.settings.chatHistory = []; await this.plugin.saveSettings(); new Notice('History cleared.'); this.app.workspace.trigger('webapp-dashboard:clear-history'); } })); }
}

// --- Chat Modal ---
class ChatModal extends Modal {
    constructor(app, plugin) { super(app); this.plugin = plugin; this.searchResults = []; this.searchResultsEl = null; this.chatLogEl = null; this.inputEl = null; this.sendButtonEl = null; this.statusEl = null; this.isThinking = false; this.modalEl.addClass('chat-modal'); console.log("ChatModal: Constructor"); }
    onOpen() { console.log("ChatModal: onOpen"); const { contentEl } = this; contentEl.empty(); contentEl.createEl('style', { text: STYLES }); const chatContainer = contentEl.createDiv({ cls: 'chat-container-modal' }); const toolbar = chatContainer.createDiv({ cls: 'toolbar-modal' }); const btnGrpL = toolbar.createDiv(); const btnGrpR = toolbar.createDiv(); toolbar.style.justifyContent = 'space-between'; btnGrpL.createEl('button', { text: 'New Chat' }).addEventListener('click', () => this.clearChat(true)); btnGrpR.createEl('button', { text: 'Create Note' }).addEventListener('click', () => this.createNoteFromChat()); btnGrpR.createEl('button', { text: 'Export Chat' }).addEventListener('click', () => this.exportChat()); this.chatLogEl = chatContainer.createDiv({ cls: 'chat-log-modal' }); this.statusEl = chatContainer.createDiv({ cls: 'thinking-indicator' }); const inputArea = chatContainer.createDiv({ cls: 'input-area-modal' }); this.searchResultsEl = inputArea.createDiv({ cls: 'search-results-modal' }); this.inputEl = inputArea.createEl('input', { cls: 'chat-input-modal', attr: { type: 'text', placeholder: 'Ask Gemini... (Type [[link, @tag, /cmd)' } }); this.sendButtonEl = inputArea.createEl('button', { text: 'Send' }); this.loadHistory(); this.setupInputListeners(); this.setThinking(false); this.inputEl.focus(); console.log("ChatModal: onOpen finished"); }
    setThinking(thinking) { this.isThinking = thinking; if (this.statusEl) { this.statusEl.textContent = thinking ? 'Gemini is thinking...' : ''; } if (this.inputEl) this.inputEl.disabled = thinking; if (this.sendButtonEl) this.sendButtonEl.disabled = thinking; console.log(`ChatModal: setThinking(${thinking}), Input disabled: ${this.inputEl?.disabled}`); }
    setupInputListeners() { this.inputEl.addEventListener('keyup', (e) => { if (this.isThinking) return; if (e.key.length > 1 && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].contains(e.key)) return; const txt = this.inputEl.value, pos = this.inputEl.selectionStart; const wiki = txt.slice(0, pos).match(/(?:^|\s)\[\[([^\]]*)$/); const mention = txt.slice(0, pos).match(/(?:^|\s)@([^\s]*)$/); if (wiki) this.searchNotes(wiki[1].toLowerCase(), this.searchResultsEl); else if (mention) this.searchTags(mention[1].toLowerCase(), this.searchResultsEl); else this.hideSearchResults(); }); this.inputEl.addEventListener('blur', () => { setTimeout(() => { if (this.searchResultsEl && !this.searchResultsEl.contains(document.activeElement)) this.hideSearchResults(); }, 150); }); this.sendButtonEl.addEventListener('click', () => this.sendMessage()); this.inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); } }); }
    async sendMessage() { if (this.isThinking) return; const message = this.inputEl.value.trim(); if (!message) return; if (message.startsWith('/')) { this.handleCommand(message); this.inputEl.value = ''; this.hideSearchResults(); return; } this.displayMessage('User', message); this.inputEl.value = ''; this.hideSearchResults(); this.setThinking(true); const apiKey = this.plugin.settings.geminiApiKey; if (!apiKey) { this.displaySystemMessage("Error: Gemini API Key not set."); this.setThinking(false); return; } const modelName = this.plugin.settings.geminiModel || DEFAULT_SETTINGS.geminiModel; const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`; const activeFile = this.app.workspace.getActiveFile(); const context = (this.plugin.settings.sendContext && activeFile) ? `[Obsidian Context: Current Note is "${activeFile.basename}"]\n` : ''; const prefix = this.plugin.settings.promptPrefix ? `${this.plugin.settings.promptPrefix}\n` : ''; const historyToSend = this.plugin.settings.chatHistory.filter(e => e.sender !== 'System').map(e => ({ role: e.sender === 'User' ? 'user' : 'model', parts: [{ text: e.message }] })); const currentMessagePart = { text: `${prefix}${context}${message}` }; const requestBody = { contents: [...historyToSend, { role: 'user', parts: [currentMessagePart] }] }; console.log("[ChatModal sendMessage] Sending to Gemini:", JSON.stringify(requestBody, null, 2)); try { const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) }); if (!response.ok) { const errorData = await response.json().catch(() => ({ error: { message: `HTTP error! status: ${response.status}` } })); throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`); } const data = await response.json(); console.log("[ChatModal sendMessage] Received from Gemini:", JSON.stringify(data, null, 2)); const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response text found."; this.displayMessage('Gemini', aiResponse); } catch (error) { console.error("ChatModal: Error calling Gemini API:", error); this.displaySystemMessage(`Error: ${error.message}`); } finally { this.setThinking(false); } }
    handleCommand(cmdStr) { console.log("ChatModal: Cmd:", cmdStr); const parts = cmdStr.split(' '); const cmd = parts[0].toLowerCase(); const args = parts.slice(1).join(' '); switch (cmd) { case '/clear': this.clearChat(true); break; case '/help': this.displaySystemMessage("Cmds: /clear, /help, /search <q>, /createNote <t>"); break; case '/search': if (!args) { this.displaySystemMessage("Usage: /search <query>"); return; } this.displaySystemMessage(`Searching: ${args}... (NYI)`); break; case '/createnote': if (!args) { this.displaySystemMessage("Usage: /createNote <Title>"); return; } this.createNoteWithTitle(args); break; default: this.displaySystemMessage(`Unknown cmd: ${cmd}. Try /help.`); } }
    clearChat(clearHistory = false) { if (this.chatLogEl) this.chatLogEl.empty(); this.displaySystemMessage("Chat cleared."); if (clearHistory) { this.plugin.settings.chatHistory = []; this.plugin.saveSettings(); new Notice("History cleared."); } }
    async createNoteWithTitle(title) { const content = `## Chat Cmd: Create Note\n\nTitle: ${title}\n\n---\n\n`; const file = await createNoteUtil(title, content, this.plugin.settings.createNoteFolder, this.app); if (file) { this.app.workspace.getLeaf(true).openFile(file); this.close(); } }
    hideSearchResults() { if (this.searchResultsEl) { this.searchResultsEl.classList.remove('active'); this.searchResultsEl.empty(); } }
    async searchNotes(q, container) { if (!q) { this.hideSearchResults(); return; } const files = this.app.vault.getMarkdownFiles(); this.searchResults = files.filter(f => f.basename.toLowerCase().includes(q)).slice(0, 5); this.displaySearchResults(this.searchResults, container, (f) => `[[${f.basename}]]`); }
    async searchTags(q, container) { if (!q) { this.hideSearchResults(); return; } const tags = Object.keys(this.app.metadataCache.getTags()); this.searchResults = tags.filter(t => t.toLowerCase().includes(q)).slice(0, 5); this.displaySearchResults(this.searchResults, container, (t) => t); }
    displaySearchResults(results, container, formatResult) { container.empty(); if (results.length === 0) { container.classList.remove('active'); return; } results.forEach(result => { const item = container.createDiv({ cls: 'search-item-modal' }); item.textContent = result.basename || result; item.addEventListener('mousedown', (e) => { e.preventDefault(); const txt = this.inputEl.value; const pos = this.inputEl.selectionStart; const before = txt.slice(0, pos).replace(/(?:^|\s)(?:\[\[|@)[^\s]*$/, ''); const after = txt.slice(pos); const fmt = formatResult(r); this.inputEl.value = before + fmt + ' ' + after; this.inputEl.focus(); const newPos = before.length + fmt.length + 1; this.inputEl.setSelectionRange(newPos, newPos); this.hideSearchResults(); }); }); container.classList.add('active'); }
    async createNoteFromChat() { console.log("ChatModal: createNote"); if (!this.chatLogEl) return; const msgs = Array.from(this.chatLogEl.children).filter(el => !el.classList.contains('system-message-modal')).map(m => m.textContent || ''); const fname = `Chat-${new Date().toISOString().replace(/[:.]/g, '-')}`; const content = msgs.join('\n\n'); await createNoteUtil(fname, content, this.plugin.settings.createNoteFolder, this.app); this.close(); }
    async exportChat() { console.log("ChatModal: exportChat"); if (!this.chatLogEl) return; const msgs = Array.from(this.chatLogEl.children).filter(el => !el.classList.contains('system-message-modal')).map(m => m.textContent || ''); const content = msgs.join('\n\n'); try { await navigator.clipboard.writeText(content); new Notice('Copied'); } catch (err) { new Notice('Failed copy'); console.error('ChatModal: Failed copy:', err); } }
    displayMessage(sender, message) { if (!this.chatLogEl) return; const msgEl = this.chatLogEl.createDiv({ cls: 'message-modal' }); const tmpDiv = document.createElement('div');
        // **Fix: Pass 'this.plugin' as component context**
        renderMarkdownUtil(`**${sender}:** ${message}`, tmpDiv, this.app, this.plugin);
        msgEl.prepend(tmpDiv); this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight; if (sender !== 'System') { this.plugin.settings.chatHistory.push({ sender, message }); while (this.plugin.settings.chatHistory.length > this.plugin.settings.maxHistoryLength) { this.plugin.settings.chatHistory.shift(); } this.plugin.saveSettings(); } }
    insertIntoEditor(text) { insertIntoEditorUtil(text, this.app); }
    displaySystemMessage(message) { if (!this.chatLogEl) return; const msgEl = this.chatLogEl.createDiv({ cls: 'message-modal system-message-modal' }); msgEl.textContent = message; this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight; }
    loadHistory() { if (!this.chatLogEl) return; this.chatLogEl.empty(); this.plugin.settings.chatHistory.forEach(e => { if (e.sender === 'System') this.displaySystemMessage(e.message); else this.displayMessage(e.sender, e.message); }); console.log(`ChatModal: Loaded ${this.plugin.settings.chatHistory.length} msgs.`); }
    onClose() { console.log("ChatModal: onClose"); const { contentEl } = this; contentEl.empty(); }
}

// --- Main Plugin Class ---
// Define the main plugin class *after* all helper classes and functions
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
                catch (e) { console.error("Err opening modal from ribbon:", e); new Notice("Failed to open chat modal."); }
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
                    catch (e) { console.error("Err opening modal from command:", e); new Notice("Failed to open chat modal."); }
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

// Export the main plugin class
module.exports = WebappDashboardPlugin;