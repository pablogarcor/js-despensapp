
/**
 * Metodos de render de configuracion y copias locales.
 */
export const settingsViewMethods = {
  renderSettingsView(dashboard) {
    const totalStoredMeals = dashboard.plannedMeals.length + dashboard.pendingMeals.length;
    const totalShoppingItems = dashboard.shoppingList.length + dashboard.shoppingExtras.length;

    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Copia local</p>
            <h2>Datos</h2>
          </div>
        </div>

        <div class="data-stats" aria-label="Datos guardados">
          <span><strong>${dashboard.pantryItems.length}</strong> alimentos</span>
          <span><strong>${dashboard.recipes.length}</strong> recetas</span>
          <span><strong>${totalStoredMeals}</strong> comidas</span>
          <span><strong>${totalShoppingItems}</strong> compra</span>
        </div>

        <div class="settings-actions">
          <button class="button full" type="button" data-action="export-backup">Exportar copia</button>
          <button class="button ghost full danger-action" type="button" data-action="clear-all-data" ${totalStoredMeals + dashboard.recipes.length + dashboard.pantryItems.length + totalShoppingItems === 0 ? 'disabled' : ''}>
            Borrar todo
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="section-heading compact">
          <h2>Importar</h2>
        </div>

        <form class="stacked-form" data-form="import-backup">
          <label>
            Archivo JSON
            <input name="backupFile" type="file" accept=".json,application/json" required />
          </label>
          <button class="button full" type="submit">Importar y reemplazar</button>
        </form>
      </section>
    `;
  }
};
