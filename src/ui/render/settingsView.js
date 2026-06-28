
/**
 * Metodos de render de configuracion y copias locales.
 */
export const settingsViewMethods = {
  renderSettingsView(dashboard) {
    const totalStoredMeals = dashboard.plannedMeals.length + dashboard.pendingMeals.length;
    const totalShoppingItems = dashboard.shoppingList.length + dashboard.shoppingExtras.length;
    const hasStoredData = totalStoredMeals + dashboard.recipes.length + dashboard.pantryItems.length + totalShoppingItems > 0;

    return `
      <section class="view-heading settings-heading">
        <div>
          <h2>Ajustes</h2>
          <p>Gestiona tus datos y preferencias de la aplicacion.</p>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-data-title">
        <h3 id="settings-data-title" class="settings-section-title">Datos</h3>

        <div class="settings-list">
          <button class="settings-row" type="button" data-action="export-backup">
            <span class="settings-row-icon">${this.renderIcon('export')}</span>
            <span class="settings-row-copy">
              <strong>Exportar JSON</strong>
              <small>Guarda una copia de seguridad local</small>
            </span>
          </button>

          <div class="settings-disclosure ${this.state.settingsImportOpen ? 'is-open' : ''}">
            <button
              class="settings-row settings-row-disclosure"
              type="button"
              data-action="toggle-settings-import"
              aria-expanded="${this.state.settingsImportOpen}"
              aria-controls="settings-import-panel"
            >
              <span class="settings-row-icon">${this.renderIcon('import')}</span>
              <span class="settings-row-copy">
                <strong>Importar JSON</strong>
                <small>Restaura datos desde un archivo .json</small>
              </span>
              <span class="settings-row-chevron">${this.renderIcon(this.state.settingsImportOpen ? 'chevronDown' : 'chevronRight')}</span>
            </button>

            ${
              this.state.settingsImportOpen
                ? `
                  <form id="settings-import-panel" class="settings-disclosure-panel settings-import-panel" data-form="import-backup">
                    <label>
                      Archivo JSON
                      <input name="backupFile" type="file" accept=".json,application/json" required />
                    </label>
                    <button class="button small" type="submit">Importar</button>
                  </form>
                `
                : ''
            }
          </div>

          <button class="settings-row danger-action" type="button" data-action="clear-all-data" ${hasStoredData ? '' : 'disabled'}>
            <span class="settings-row-icon">${this.renderIcon('delete')}</span>
            <span class="settings-row-copy">
              <strong>Borrar todo</strong>
              <small>Elimina despensa, recetas, plan y compra</small>
            </span>
          </button>
        </div>
      </section>

      <section class="settings-section" aria-labelledby="settings-app-title">
        <h3 id="settings-app-title" class="settings-section-title">Aplicacion</h3>
        ${this.renderInstallSettingsPanel()}
      </section>
    `;
  }
};
