const { App, PluginSettingTab, Setting, Notice } = require('obsidian');

// --- Default Settings ---
const DEFAULT_SETTINGS = {
    websocketUrl: 'ws://localhost:8080',
    promptPrefix: '',
    sendContext: true,
    maxHistoryLength: 100,
    createNoteFolder: '',
    insertTemplate: '> {response}', // Default template: blockquote
    chatHistory: []
};

class WebappDashboardSettingTab extends PluginSettingTab {
    /** @param {App} app */
    /** @param {import('./main').WebappDashboardPlugin} plugin */
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl('h2', {text: 'Webapp Dashboard Settings'});

        containerEl.createEl('h3', { text: 'Connection' });
		new Setting(containerEl)
			.setName('WebSocket URL')
			.setDesc('Address of the WebSocket server.')
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.websocketUrl)
				.setValue(this.plugin.settings.websocketUrl)
				.onChange(async (value) => {
					this.plugin.settings.websocketUrl = value || DEFAULT_SETTINGS.websocketUrl;
					await this.plugin.saveSettings();
                    new Notice('WebSocket URL updated. Reopen chat window to reconnect.');
				}));

        containerEl.createEl('h3', { text: 'Chat Behavior' });
        new Setting(containerEl)
			.setName('Custom Prompt Prefix')
			.setDesc('Text automatically prepended to every message sent (e.g., instructions for an AI).')
			.addTextArea(text => text
				.setPlaceholder('e.g., Act as an Obsidian assistant...')
				.setValue(this.plugin.settings.promptPrefix)
				.onChange(async (value) => {
					this.plugin.settings.promptPrefix = value;
					await this.plugin.saveSettings();
				}));

        new Setting(containerEl)
            .setName('Send Active Note Context')
            .setDesc('Include the name of the currently active note as context in messages sent.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.sendContext)
                .onChange(async (value) => {
                    this.plugin.settings.sendContext = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Insert Response Template')
            .setDesc('Template for inserting server responses into the editor. Use {response} as placeholder.')
            .addText(text => text
                .setPlaceholder(DEFAULT_SETTINGS.insertTemplate)
                .setValue(this.plugin.settings.insertTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.insertTemplate = value || DEFAULT_SETTINGS.insertTemplate;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'History & Export' });
        new Setting(containerEl)
            .setName('Maximum History Length')
            .setDesc('Number of messages to keep in the chat history.')
            .addText(text => text // Use text input for number
                .setPlaceholder(String(DEFAULT_SETTINGS.maxHistoryLength))
                .setValue(String(this.plugin.settings.maxHistoryLength))
                .onChange(async (value) => {
                    const num = parseInt(value, 10);
                    this.plugin.settings.maxHistoryLength = (isNaN(num) || num < 0) ? DEFAULT_SETTINGS.maxHistoryLength : num;
                    // Trim history if needed
                    if (this.plugin.settings.chatHistory.length > this.plugin.settings.maxHistoryLength) {
                        this.plugin.settings.chatHistory = this.plugin.settings.chatHistory.slice(-this.plugin.settings.maxHistoryLength);
                    }
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Create Note Folder')
            .setDesc('Folder path where new notes created from chat will be saved (leave blank for vault root).')
            .addText(text => text
                .setPlaceholder('e.g., Chats/')
                .setValue(this.plugin.settings.createNoteFolder)
                .onChange(async (value) => {
                    // Basic path cleaning
                    this.plugin.settings.createNoteFolder = value.trim().replace(/\\/g, '/').replace(/\/$/, ''); // Use forward slashes, remove trailing slash
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Clear Chat History')
            .setDesc('Permanently delete the saved chat history.')
            .addButton(button => button
                .setButtonText('Clear History')
                .setWarning()
                .onClick(async () => {
                    if (confirm('Are you sure you want to clear the chat history? This cannot be undone.')) {
                        this.plugin.settings.chatHistory = [];
                        await this.plugin.saveSettings();
                        new Notice('Chat history cleared.');
                        this.app.workspace.trigger('webapp-dashboard:clear-history');
                    }
                }));
	}
}

module.exports = { WebappDashboardSettingTab, DEFAULT_SETTINGS };