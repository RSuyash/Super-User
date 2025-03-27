# Super User: Obsidian Chat Plugin

## Description

Super User is an Obsidian plugin that provides a chat interface, allowing you to interact with AI models directly within your Obsidian vault. It supports features like note linking, tag mentions, and customizable prompts to enhance your note-taking and knowledge management workflow.

## Features

*   **Floating Chat Modal:** Opens a chat window similar to Obsidian's command palette.
*   **Gemini API Integration:** Connects directly to the Google Gemini API for AI-powered conversations.
*   **Markdown Support:** Render Markdown formatting in chat messages.
*   **Note Linking & Tag Mentions:** Use `[[...]]` to link to Obsidian notes and `@...` to mention tags.
*   **Customizable Prompt:** Set a custom prompt prefix to guide the AI's behavior.
*   **Contextual Awareness:** Optionally send the name of the currently active note as context to the AI.
*   **Chat History:** Saves and loads chat history across Obsidian sessions.
*   **Create Note:** Export the chat log to a new Obsidian note.
*   **Copy to Clipboard:** Copy the chat log to your clipboard.
*   **Settings Tab:** Configure API key, model, and other options.

## Installation

1.  Download the latest release of the plugin from [GitHub Releases URL (replace with actual URL when available)].
2.  Extract the plugin folder (`Super User`) to your Obsidian vault's plugins folder: `<your vault>/.obsidian/plugins/`.
    *   Note: On some machines, the `.obsidian` folder may be hidden. Make sure you can view hidden files.
3.  Restart Obsidian.
4.  If prompted about Safe Mode, you can disable Safe Mode and enable the "Super User" plugin.
5.  Configure the plugin settings in Obsidian's settings menu (Community plugins -> Super User).

## Usage

1.  **Enable the Plugin:** Go to Settings -> Community Plugins and ensure "Super User" is enabled.
2.  **Configure Settings:** Go to Settings -> Community Plugins -> Super User to configure the plugin:
    *   **Gemini API Key:** Enter your Google AI Gemini API key.
    *   **Gemini Model:** Select the desired Gemini model (e.g., `gemini-pro`).
    *   **Prompt Prefix:** Set a custom prompt to instruct the AI (e.g., "Act as a helpful research assistant").
    *   **Send Context:** Enable or disable sending the active note's name as context.
    *   **Insert Template:** Customize the template used when inserting server responses into the editor.
    *   **Max History Length:** Set the maximum number of messages to store in chat history.
    *   **Create Note Folder:** Specify the folder where new notes created from the chat will be saved.
3.  **Open the Chat:**
    *   Click the "Super User" icon in the left ribbon.
    *   Use the command palette (Ctrl+P or Cmd+P) and type "Open Webapp Chat".
    *   Use the hotkey (Ctrl+Shift+C or Cmd+Shift+C).
4.  **Chat with Gemini:** Type your message in the input field and press Enter or click the "Send" button.
5.  **Use Features:**
    *   **Note Linking:** Type `[[` to search for and link to existing notes.
    *   **Tag Mentions:** Type `@` to search for and mention tags.
    *   **Insert Response:** Click the "Insert" button on a server message to insert the response into the active editor.
    *   **Create Note:** Click the "Create Note" button to export the chat log to a new note.
    *   **Export Chat:** Click the "Export Chat" button to copy the chat log to your clipboard.
    *   **Chat Commands:**
        *   `/clear`: Clears the chat history.
        *   `/help`: Displays a list of available commands.
        *   `/createNote <Note Title>`: Creates a new note with the specified title.

## Support and Contribution

[Add information about how users can get support or contribute to the plugin.]

## License

MIT License

Copyright (c) 2025 Roo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Credits

*   Developed by Roo
*   [Add any acknowledgements or credits to libraries or resources used]