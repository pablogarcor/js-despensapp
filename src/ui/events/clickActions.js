import { actionSheetDismissMethods } from './clickActions/actionSheetDismissals.js';
import { appClickActionMethods } from './clickActions/appActions.js';
import { installPromptClickActionMethods } from './clickActions/installPromptActions.js';
import { pantryClickActionMethods } from './clickActions/pantryActions.js';
import { planClickActionMethods } from './clickActions/planActions.js';
import { recipeClickActionMethods } from './clickActions/recipeActions.js';
import { settingsClickActionMethods } from './clickActions/settingsActions.js';
import { shoppingClickActionMethods } from './clickActions/shoppingActions.js';

/**
 * Metodos de navegacion y despacho de acciones disparadas por click.
 */
export const clickActionMethods = {
  /**
   * Gestiona clicks de botones y navegacion.
   *
   * @param {MouseEvent} event Evento de click.
   * @returns {Promise<void>}
   */
  async handleClick(event) {
    const actionElement = event.target.closest('[data-action]');
    const viewElement = event.target.closest('[data-view]');

    if (viewElement) {
      this.state.activeView = viewElement.dataset.view;
      this.render();
      return;
    }

    if (!actionElement || this.state.isBusy) {
      return;
    }

    const { action, id } = actionElement.dataset;
    let recipeSheetScrollTop = null;

    await this.runSafely(async () => {
      let shouldRefresh = true;

      if (this.applyActionSheetDismiss(action)) {
        shouldRefresh = false;
      } else {
        const result = await this.resolveClickAction({ action, id, actionElement });

        if (result) {
          shouldRefresh = result.shouldRefresh;
          recipeSheetScrollTop = result.recipeSheetScrollTop ?? null;
        }
      }

      if (shouldRefresh) {
        await this.refresh();
      } else {
        this.render();
      }

      if (recipeSheetScrollTop !== null) {
        this.restoreEntitySheetScroll(recipeSheetScrollTop);
      }

      if (action === 'scroll-plan-day') {
        this.scrollToPlanDay(actionElement.dataset.date);
      }
    });
  },

  /**
   * Busca el primer grupo capaz de gestionar una accion de click.
   *
   * @param {{action: string, id?: string, actionElement: HTMLElement}} context Contexto de click.
   * @returns {Promise<null | {shouldRefresh: boolean, recipeSheetScrollTop?: number | null}>} Resultado.
   */
  async resolveClickAction(context) {
    const handlers = [
      this.handleAppClickAction,
      this.handleInstallPromptClickAction,
      this.handleSettingsClickAction,
      this.handlePantryClickAction,
      this.handleRecipeClickAction,
      this.handleShoppingClickAction,
      this.handlePlanClickAction,
      this.handleIngredientRowClickAction,
    ];

    for (const handler of handlers) {
      const result = await handler.call(this, context);

      if (result) {
        return result;
      }
    }

    return null;
  },

  ...actionSheetDismissMethods,
  ...appClickActionMethods,
  ...installPromptClickActionMethods,
  ...settingsClickActionMethods,
  ...pantryClickActionMethods,
  ...recipeClickActionMethods,
  ...shoppingClickActionMethods,
  ...planClickActionMethods,
};
