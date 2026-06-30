import { getPwaInstallPromptCopy } from '../../pwa/installPrompt.js';

/**
 * Metodos de render relacionados con instalacion PWA.
 */
export const installPromptViewMethods = {
  /**
   * Renderiza el aviso de instalacion PWA cuando procede.
   *
   * @returns {string} HTML del aviso.
   */
  renderInstallPrompt() {
    const installPrompt = this.state.installPrompt;

    if (!this.state.installPromptVisible || !installPrompt?.shouldShowPrompt) {
      return '';
    }

    return `
      <section class="install-prompt-backdrop" role="presentation">
        ${this.renderInstallPromptCard()}
      </section>
    `;
  },

  /**
   * Renderiza la seccion estatica de instalacion en configuracion.
   *
   * @returns {string} HTML de la seccion o cadena vacia.
   */
  renderInstallSettingsPanel() {
    if (this.state.installPrompt?.isInstalled) {
      return `
        <div class="settings-list">
          <div class="settings-row">
            <span class="settings-row-icon">${this.renderIcon('done')}</span>
            <span class="settings-row-copy">
              <strong>App instalada</strong>
              <small>DespensApp ya se ejecuta como aplicacion instalada</small>
            </span>
          </div>
        </div>
      `;
    }

    const copy = getPwaInstallPromptCopy(this.state.installPrompt);

    return `
      <div class="settings-list">
        <div class="settings-disclosure ${this.state.settingsInstallOpen ? 'is-open' : ''}">
          <button
            class="settings-row settings-row-disclosure"
            type="button"
            data-action="toggle-settings-install"
            aria-expanded="${this.state.settingsInstallOpen}"
            aria-controls="settings-install-panel"
          >
            <span class="settings-row-icon">${this.renderIcon('import')}</span>
            <span class="settings-row-copy">
              <strong>Instalar App</strong>
              <small>Anadir a la pantalla de inicio</small>
            </span>
            <span class="settings-row-chevron">${this.renderIcon(this.state.settingsInstallOpen ? 'chevronDown' : 'chevronRight')}</span>
          </button>

          ${
            this.state.settingsInstallOpen
              ? `
                <div id="settings-install-panel" class="settings-disclosure-panel settings-install-panel">
                  <ol class="settings-install-steps">
                    ${copy.steps.map((step) => `<li>${step}</li>`).join('')}
                  </ol>
                  ${
                    this.state.installPrompt.canUseNativePrompt
                      ? `<button class="button small" type="button" data-action="install-app">${copy.nativeButtonLabel}</button>`
                      : ''
                  }
                </div>
              `
              : ''
          }
        </div>
      </div>
    `;
  },

  /**
   * Renderiza la tarjeta modal de instalacion PWA.
   *
   * @returns {string} HTML de la tarjeta.
   */
  renderInstallPromptCard() {
    const installPrompt = this.state.installPrompt;
    const copy = getPwaInstallPromptCopy(installPrompt);
    const actions = [
      installPrompt.canUseNativePrompt
        ? `<button class="button" type="button" data-action="install-app">${copy.nativeButtonLabel}</button>`
        : '',
      '<button class="button ghost" type="button" data-action="dismiss-install-prompt">Ahora no</button>',
    ].filter(Boolean);

    return `
      <div class="install-prompt" role="dialog" aria-modal="true" aria-labelledby="install-prompt-title">
        <div>
          <p class="eyebrow">Acceso directo</p>
          <h2 id="install-prompt-title">${copy.title}</h2>
        </div>
        <ol class="install-steps">
          ${copy.steps.map((step) => `<li>${step}</li>`).join('')}
        </ol>
        ${actions.length > 0 ? `<div class="install-actions">${actions.join('')}</div>` : ''}
      </div>
    `;
  },
};
