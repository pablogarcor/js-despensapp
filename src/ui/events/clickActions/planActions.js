/**
 * Acciones de click de planificacion y comidas pendientes.
 */
export const planClickActionMethods = {
  async handlePlanClickAction({ action, id, actionElement }) {
    if (action === 'delete-planned-meal') {
      await this.service.deletePlannedMeal(id);
      this.showToast('Comida eliminada del plan.');
      return { shouldRefresh: true };
    }

    if (action === 'edit-planned-meal') {
      this.state.editingPlannedMealId = id;
      this.state.planActionsOpen = false;
      this.state.activeMealSlotKey = null;
      this.state.activeNoteSlotKey = null;
      return { shouldRefresh: false };
    }

    if (action === 'adjust-number-input') {
      this.adjustNumberInput(actionElement);
      return { shouldRefresh: false };
    }

    if (action === 'clear-plan') {
      const deletedCount = await this.service.clearCurrentAndFutureMeals();
      this.state.planActionsOpen = false;
      this.state.activeMealSlotKey = null;
      this.state.activeNoteSlotKey = null;
      this.showToast(`${deletedCount} comidas eliminadas del plan.`);
      return { shouldRefresh: true };
    }

    if (action === 'show-plan-actions') {
      this.state.planActionsOpen = true;
      return { shouldRefresh: false };
    }

    if (action === 'show-pending-meals') {
      if (!this.state.dashboard?.pendingMeals.length) {
        return { shouldRefresh: false };
      }

      this.openPendingMealsModal();
      return { shouldRefresh: false };
    }

    if (action === 'scroll-plan-day') {
      this.state.selectedPlanDate = actionElement.dataset.date;
      return { shouldRefresh: false };
    }

    if (action === 'show-note-slot') {
      this.state.activeNoteSlotKey = actionElement.dataset.slotKey;
      this.state.activeMealSlotKey = null;
      return { shouldRefresh: false };
    }

    if (action === 'hide-note-slot') {
      this.state.activeNoteSlotKey = null;
      return { shouldRefresh: false };
    }

    if (action === 'show-planned-meal-slot') {
      this.state.activeMealSlotKey = actionElement.dataset.slotKey;
      this.state.activeNoteSlotKey = null;
      this.state.editingPlannedMealId = null;
      this.state.planActionsOpen = false;
      return { shouldRefresh: false };
    }

    if (action === 'resolve-meal') {
      await this.service.resolvePastMeal(id, actionElement.dataset.cooked === 'true');
      this.showToast('Comida pendiente resuelta.');
      return { shouldRefresh: true };
    }

    return null;
  },
};
