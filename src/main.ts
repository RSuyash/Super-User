import { Plugin } from 'obsidian';

export default class WebappDashboardPlugin extends Plugin {
  async onload() {
    console.log('Minimal Webapp Dashboard Plugin loaded!');
  }

  onunload() {
    console.log('Minimal Webapp Dashboard Plugin unloaded!');
  }
}