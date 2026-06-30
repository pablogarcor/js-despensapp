import {
  dismissPwaInstallPrompt,
  getPwaInstallPromptState,
  promptPwaInstall,
} from '../../../pwa/installPrompt.js';

/**
 * Acciones del aviso de instalacion PWA.
 */
export const installPromptClickActionMethods = {
  async handleInstallPromptClickAction({ action }) {
    if (action === 'dismiss-install-prompt') {
      dismissPwaInstallPrompt();
      this.state.installPrompt = getPwaInstallPromptState();
      this.state.installPromptVisible = false;
      return { shouldRefresh: false };
    }

    if (action !== 'install-app') {
      return null;
    }

    const result = await promptPwaInstall();

    if (result?.outcome !== 'accepted') {
      dismissPwaInstallPrompt();
    }

    this.state.installPrompt = getPwaInstallPromptState();
    this.state.installPromptVisible = false;

    if (result?.outcome === 'accepted') {
      this.showToast('Instalacion iniciada.');
    }

    return { shouldRefresh: false };
  },
};
