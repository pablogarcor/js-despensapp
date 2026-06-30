import { DomainError } from '../../../domain/errors.js';

/**
 * Envios de formularios de configuracion.
 */
export const settingsFormSubmitMethods = {
  async handleSettingsFormSubmit({ form }) {
    if (!form.matches('[data-form="import-backup"]')) {
      return null;
    }

    const file = form.elements.backupFile.files[0];

    if (!file) {
      throw new DomainError('Selecciona un archivo JSON para importar.', 'BACKUP_FILE_REQUIRED');
    }

    if (!window.confirm('Importar esta copia reemplazara los datos actuales.')) {
      return { shouldRefresh: false };
    }

    const summary = await this.service.importBackup(await file.text());
    form.reset();
    this.state.activeView = 'settings';
    this.state.settingsImportOpen = false;
    this.showToast(
      `Importados ${summary.pantryItems} alimentos, ${summary.recipes} recetas, ${summary.plannedMeals} comidas y ${summary.shoppingItems} compras.`,
    );

    return { shouldRefresh: true };
  },
};
