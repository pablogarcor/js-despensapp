import { PLAN_NOTE_TITLES } from '../../domain/types.js';
import { escapeAttribute, escapeHtml } from '../renderUtils.js';
import { getPlanSlotKey } from './planSlotKeys.js';

/**
 * Metodos de render para crear y editar comidas planificadas.
 */
export const plannedMealEditorRenderMethods = {
  renderPlannedMealSheet(dashboard) {
    const editingMeal = dashboard.plannedMeals.find((candidate) => candidate.id === this.state.editingPlannedMealId);

    if (editingMeal?.kind === 'note') {
      return this.renderPlannedNoteEditor(editingMeal);
    }

    if (editingMeal && editingMeal.kind !== 'note') {
      const recipe = dashboard.recipes.find((candidate) => candidate.id === editingMeal.recipeId);

      return this.renderPlannedMealEditor({
        title: 'Editar comida',
        titleId: 'edit-planned-meal-title',
        dismissAction: 'cancel-edit-planned-meal',
        dataForm: 'planned-meal-edit',
        hiddenInputs: [
          { name: 'plannedMealId', value: editingMeal.id },
          { name: 'recipeId', value: editingMeal.recipeId },
        ],
        recipeField: this.renderSelectedRecipeField(recipe?.name ?? 'Receta eliminada'),
        servings: editingMeal.servings,
        submitLabel: 'Guardar cambios',
      });
    }

    const slot = dashboard.missingPlanSlots.find((candidate) =>
      getPlanSlotKey(candidate) === this.state.activeMealSlotKey,
    );

    if (!slot) {
      return '';
    }

    const compatibleRecipes = dashboard.recipes.filter((recipe) => recipe.mealTypes.includes(slot.mealType));
    const noRecipeAvailable = compatibleRecipes.length === 0;

    return this.renderPlannedMealEditor({
      title: 'Añadir comida',
      titleId: 'add-planned-meal-title',
      dismissAction: 'hide-planned-meal-slot',
      dataForm: 'planned-meal',
      hiddenInputs: [
        { name: 'date', value: slot.date },
        { name: 'mealType', value: slot.mealType },
        ...(noRecipeAvailable ? [{ name: 'noCook', value: 'true' }] : []),
      ],
      recipeField: this.renderRecipeSelectField(compatibleRecipes),
      servings: 1,
      submitLabel: 'Añadir comida',
      noCookChecked: noRecipeAvailable,
      noCookDisabled: noRecipeAvailable,
    });
  },

  renderPlannedNoteEditor(meal) {
    return this.renderActionSheet({
      title: 'Editar comida',
      titleId: 'edit-planned-note-title',
      dismissAction: 'cancel-edit-planned-meal',
      className: 'meal-edit-sheet',
      visibleTitle: true,
      form: {
        className: 'meal-edit-sheet-form',
        dataForm: 'planned-note-edit',
        hiddenInputs: [{ name: 'plannedMealId', value: meal.id }],
      },
      body: `
        <div class="meal-edit-sheet-body">
          ${this.renderSheetContext({
            icon: 'noUtensils',
            label: 'No cocinar seleccionado',
            title: meal.title,
            detail: meal.note ?? '',
            iconClass: 'is-no-cook',
          })}

          <label class="meal-edit-field">
            <span>Motivo</span>
            <select name="title" required>
              ${PLAN_NOTE_TITLES.map((title) => `
                <option value="${escapeAttribute(title)}" ${meal.title === title ? 'selected' : ''}>
                  ${escapeHtml(title)}
                </option>
              `).join('')}
            </select>
          </label>

          <label class="meal-edit-field">
            <span>Detalle</span>
            <input name="note" type="text" autocomplete="off" value="${escapeAttribute(meal.note ?? '')}" />
          </label>

          <label class="meal-edit-no-cook">
            <span class="meal-edit-no-cook-icon" aria-hidden="true">${this.renderIcon('noUtensils')}</span>
            <span class="meal-edit-no-cook-copy">
              <strong>No cocinar esta vez</strong>
              <small>Comer fuera o sobras</small>
            </span>
            <input type="checkbox" value="true" checked disabled />
            <span class="meal-edit-switch" aria-hidden="true"></span>
          </label>
        </div>
      `,
      footer: this.renderSheetActions({
        submitLabel: 'Guardar cambios',
        cancelAction: 'cancel-edit-planned-meal',
      }),
    });
  },

  renderPlannedMealEditor({
    title,
    titleId,
    dismissAction,
    dataForm,
    hiddenInputs,
    recipeField,
    servings,
    submitLabel,
    noCookChecked = false,
    noCookDisabled = false,
  }) {
    const servingsInputId = `${titleId}-servings`;

    return this.renderActionSheet({
      title,
      titleId,
      dismissAction,
      className: 'meal-edit-sheet',
      visibleTitle: true,
      form: {
        className: 'meal-edit-sheet-form',
        dataForm,
        hiddenInputs: [
          ...hiddenInputs,
          { name: 'noCookTitle', value: 'Comer fuera' },
          { name: 'noCookNote', value: 'Sobras' },
        ],
      },
      body: `
        <div class="meal-edit-sheet-body">
          <div class="sheet-context">
            <span class="sheet-context-icon" aria-hidden="true">${this.renderIcon('utensils')}</span>
            ${recipeField}
          </div>

          <label class="meal-edit-servings" for="${escapeAttribute(servingsInputId)}">
            <span>Raciones a cocinar</span>
          </label>
          <div class="meal-servings-stepper">
            <button
              type="button"
              data-action="adjust-number-input"
              data-target="servings"
              data-step="-0.5"
              aria-label="Restar raciones"
            >
              ${this.renderIcon('minus')}
            </button>
            <input
              id="${escapeAttribute(servingsInputId)}"
              name="servings"
              type="number"
              inputmode="decimal"
              min="0.5"
              step="0.5"
              max="99"
              value="${escapeAttribute(String(servings))}"
              required
            />
            <button
              type="button"
              data-action="adjust-number-input"
              data-target="servings"
              data-step="0.5"
              aria-label="Sumar raciones"
            >
              ${this.renderIcon('add')}
            </button>
          </div>

          <label class="meal-edit-no-cook">
            <span class="meal-edit-no-cook-icon" aria-hidden="true">${this.renderIcon('noUtensils')}</span>
            <span class="meal-edit-no-cook-copy">
              <strong>No cocinar esta vez</strong>
              <small>Comer fuera o sobras</small>
            </span>
            <input type="checkbox" name="noCook" value="true" ${noCookChecked ? 'checked' : ''} ${noCookDisabled ? 'disabled' : ''} />
            <span class="meal-edit-switch" aria-hidden="true"></span>
          </label>
        </div>
      `,
      footer: this.renderSheetActions({
        submitLabel,
        cancelAction: dismissAction,
      }),
    });
  },

  renderSelectedRecipeField(recipeName) {
    return `
      <div class="sheet-context-copy">
        <span>Receta seleccionada</span>
        <strong>${escapeHtml(recipeName)}</strong>
      </div>
    `;
  },

  renderRecipeSelectField(recipes) {
    if (recipes.length === 0) {
      return `
        <div class="sheet-context-copy">
          <span>Receta seleccionada</span>
          <strong>Sin receta compatible</strong>
          <small>Crea una receta para esta franja o guarda como no cocinar.</small>
        </div>
      `;
    }

    return `
      <label class="sheet-context-copy">
        <span>Receta seleccionada</span>
        <select class="sheet-context-select" name="recipeId" required>
          ${recipes.map((recipe) => `
            <option value="${escapeAttribute(recipe.id)}">${escapeHtml(recipe.name)}</option>
          `).join('')}
        </select>
      </label>
    `;
  },
};
