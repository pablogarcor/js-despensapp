import { pantryFormSubmitMethods } from './formSubmit/pantryForms.js';
import { planFormSubmitMethods } from './formSubmit/planForms.js';
import { recipeFormSubmitMethods } from './formSubmit/recipeForms.js';
import { settingsFormSubmitMethods } from './formSubmit/settingsForms.js';
import { shoppingFormSubmitMethods } from './formSubmit/shoppingForms.js';

/**
 * Metodos de despacho de formularios de la aplicacion.
 */
export const formSubmitMethods = {
  /**
   * Gestiona formularios de alta, edicion y planificacion.
   *
   * @param {SubmitEvent} event Evento de submit.
   * @returns {Promise<void>}
   */
  async handleSubmit(event) {
    event.preventDefault();

    const form = event.target;

    if (this.state.isBusy) {
      return;
    }

    await this.runSafely(async () => {
      const result = await this.resolveFormSubmit({
        form,
        submitter: event.submitter,
      });

      if (result?.shouldRefresh === false) {
        this.render();
        return;
      }

      await this.refresh();
    });
  },

  /**
   * Busca el primer grupo capaz de gestionar un formulario.
   *
   * @param {{form: HTMLFormElement, submitter?: HTMLElement | null}} context Contexto de envio.
   * @returns {Promise<null | {shouldRefresh: boolean}>} Resultado.
   */
  async resolveFormSubmit(context) {
    const handlers = [
      this.handlePantryFormSubmit,
      this.handleRecipeFormSubmit,
      this.handlePlanFormSubmit,
      this.handleSettingsFormSubmit,
      this.handleShoppingFormSubmit,
    ];

    for (const handler of handlers) {
      const result = await handler.call(this, context);

      if (result) {
        return result;
      }
    }

    return null;
  },

  ...pantryFormSubmitMethods,
  ...recipeFormSubmitMethods,
  ...planFormSubmitMethods,
  ...settingsFormSubmitMethods,
  ...shoppingFormSubmitMethods,
};
