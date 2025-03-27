const { MarkdownRenderer, Notice, App } = require('obsidian');

/**
 * Renders markdown text to an HTML element.
 * @param {string} markdownText The markdown text to render.
 * @param {HTMLElement} targetEl The element to render into.
 * @param {App} app Obsidian App instance.
 * @param {import('obsidian').Component} component Component context.
 */
function renderMarkdown(markdownText, targetEl, app, component) {
    const sourcePath = app.workspace.getActiveFile()?.path || app.vault.getRoot().path;
    MarkdownRenderer.renderMarkdown(markdownText, targetEl, sourcePath, component);
}

/**
 * Inserts text into the active editor at the current cursor position.
 * @param {string} text The text to insert.
 * @param {App} app Obsidian App instance.
 */
function insertIntoEditor(text, app) {
    const editor = app.workspace.activeEditor?.editor;
    if (editor) {
        editor.replaceSelection(text);
        new Notice('Text inserted into editor');
    } else {
        new Notice('No active editor found to insert text');
    }
}

/**
 * Sanitizes a string to be used as a filename.
 * @param {string} name
 * @returns {string}
 */
function sanitizeFilename(name) {
    // Remove characters not allowed in filenames on most systems
    return name.replace(/[\\/:*?"<>|]/g, '-');
}

/**
 * Creates a new note with the given title and content.
 * @param {string} title
 * @param {string} content
 * @param {string} folderPath - Folder to create the note in (empty for root).
 * @param {App} app
 */
async function createNote(title, content, folderPath, app) {
    const sanitizedTitle = sanitizeFilename(title);
    const fullPath = folderPath ? `${folderPath}/${sanitizedTitle}.md` : `${sanitizedTitle}.md`;

    try {
        // Check if folder exists, create if not
        if (folderPath && !await app.vault.adapter.exists(folderPath)) {
            await app.vault.createFolder(folderPath);
            console.log(`Created folder: ${folderPath}`);
        }

        // Check if file exists
        const fileExists = await app.vault.adapter.exists(fullPath);
        let finalPath = fullPath;
        let counter = 1;
        // Append counter if file exists
        while (await app.vault.adapter.exists(finalPath)) {
            finalPath = folderPath
                ? `${folderPath}/${sanitizedTitle}-${counter}.md`
                : `${sanitizedTitle}-${counter}.md`;
            counter++;
        }

        const newFile = await app.vault.create(finalPath, content);
        new Notice(`Note created: ${newFile.basename}`);
        return newFile;
    } catch (error) {
        new Notice(`Failed to create note: ${error.message}`);
        console.error('Utils: Failed to create note:', error);
        return null;
    }
}


module.exports = {
    renderMarkdown,
    insertIntoEditor,
    createNote,
    sanitizeFilename
};