/**
 * Envios de formularios de planificacion y comidas.
 */
export const planFormSubmitMethods = {
  async handlePlanFormSubmit({ form, submitter }) {
    if (form.matches('[data-form="plan-week"]')) {
      const data = new FormData(form);
      const mode = submitter?.dataset.planMode ?? 'reset';
      const result =
        mode === 'complete'
          ? await this.service.completeWeekPlan({ servings: data.get('servings') })
          : await this.service.planNextWeek({ servings: data.get('servings') });
      const skippedMessage =
        result.missingSlots.length > 0 ? ` ${result.missingSlots.length} huecos sin receta compatible.` : '';
      const createdMessage =
        mode === 'complete'
          ? `${result.plannedMeals.length} huecos completados.`
          : 'Semana planificada.';
      this.state.planActionsOpen = false;
      this.showToast(`${createdMessage}${skippedMessage}`);
      return { shouldRefresh: true };
    }

    if (form.matches('[data-form="planned-meal"]')) {
      const data = new FormData(form);

      if (data.get('noCook') === 'true') {
        await this.service.createPlannedNote({
          date: data.get('date'),
          mealType: data.get('mealType'),
          title: data.get('noCookTitle'),
          note: data.get('noCookNote'),
        });
      } else {
        await this.service.createPlannedMeal({
          date: data.get('date'),
          mealType: data.get('mealType'),
          recipeId: data.get('recipeId'),
          servings: data.get('servings'),
        });
      }

      this.state.activeMealSlotKey = null;
      this.state.activeNoteSlotKey = null;
      this.showToast(data.get('noCook') === 'true' ? 'Hueco marcado como no cocinar.' : 'Comida anadida al plan.');
      return { shouldRefresh: true };
    }

    if (form.matches('[data-form="planned-meal-edit"]')) {
      const data = new FormData(form);

      if (data.get('noCook') === 'true') {
        await this.service.convertPlannedMealToNote(data.get('plannedMealId'), {
          title: data.get('noCookTitle'),
          note: data.get('noCookNote'),
        });
      } else {
        await this.service.updatePlannedMeal(data.get('plannedMealId'), {
          recipeId: data.get('recipeId'),
          servings: data.get('servings'),
        });
      }

      this.state.editingPlannedMealId = null;
      this.showToast('Comida actualizada.');
      return { shouldRefresh: true };
    }

    if (form.matches('[data-form="planned-note"]')) {
      const data = new FormData(form);
      await this.service.createPlannedNote({
        date: data.get('date'),
        mealType: data.get('mealType'),
        title: data.get('title'),
        note: data.get('note'),
      });
      this.state.activeMealSlotKey = null;
      this.state.activeNoteSlotKey = null;
      this.showToast('Hueco marcado como no cocinar.');
      return { shouldRefresh: true };
    }

    if (!form.matches('[data-form="planned-note-edit"]')) {
      return null;
    }

    const data = new FormData(form);
    await this.service.updatePlannedNote(data.get('plannedMealId'), {
      title: data.get('title'),
      note: data.get('note'),
    });
    this.state.editingPlannedMealId = null;
    this.showToast('No cocinar actualizado.');

    return { shouldRefresh: true };
  },
};
