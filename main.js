const { Plugin, Modal, Notice, App, PluginSettingTab, Setting, WorkspaceLeaf, ItemView } = require('obsidian');
const ChatModal = require('./ChatModal');
const { WebappDashboardSettingTab, DEFAULT_SETTINGS } = require('./SettingsTab');

module.exports = class WebappDashboardPlugin extends Plugin {
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
                catch (e) { console.error("Error opening modal from ribbon:", e); new Notice("Failed to open chat modal."); }
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
                    catch (e) { console.error("Error opening modal from command:", e); new Notice("Failed to open chat modal."); }
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