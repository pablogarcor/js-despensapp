
/**
 * Metodos de render de configuracion y copias locales.
 */
export const settingsViewMethods = {
  renderSettingsView(dashboard) {
    const totalStoredMeals = dashboard.plannedMeals.length + dashboard.pendingMeals.length;
    const totalShoppingItems = dashboard.shoppingList.length + dashboard.shoppingExtras.length;

    return `
      <section class="view-heading">
        <div>
          <h2>Ajustes</h2>
          <p>Gestiona los datos de tu despensa</p>
        </div>
      </section>

      <section class="settings-panel">
        <div class="data-stats" aria-label="Datos guardados">
          <span><strong>${dashboard.pantryItems.length}</strong> alimentos</span>
          <span><strong>${dashboard.recipes.length}</strong> recetas</span>
          <span><strong>${totalStoredMeals}</strong> plan</span>
          <span><strong>${totalShoppingItems}</strong> compra</span>
        </div>

        <div class="settings-list">
          <button class="settings-row" type="button" data-action="export-backup">
            <span class="settings-row-icon">${this.renderIcon('export')}</span>
            <span>Exportar JSON</span>
          </button>

          <form class="settings-row settings-import-row" data-form="import-backup">
            <span class="settings-row-icon">${this.renderIcon('import')}</span>
            <label>
              Importar JSON
              <input name="backupFile" type="file" accept=".json,application/json" required />
            </label>
            <button class="button small" type="submit">Importar</button>
          </form>

          <button class="settings-row danger-action" type="button" data-action="clear-all-data" ${totalStoredMeals + dashboard.recipes.length + dashboard.pantryItems.length + totalShoppingItems === 0 ? 'disabled' : ''}>
            <span class="settings-row-icon">${this.renderIcon('delete')}</span>
            <span>Borrar todo</span>
          </button>
        </div>
      </section>

      ${this.renderInstallSettingsPanel()}
    `;
  }
};
