import { MEAL_TYPE_LABELS, MEAL_TYPES } from '../../domain/types.js';
import { createIngredientRow } from '../uiState.js';
import { escapeAttribute, escapeHtml } from '../renderUtils.js';

/**
 * Metodos de render para crear y editar recetas.
 */
export const recipeFormRenderMethods = {
  renderIngredientRow(row, pantryItems, options = {}) {
    const rowAttribute = options.rowAttribute ?? 'data-ingredient-row';
    const removeAction = options.removeAction ?? 'remove-ingredient-row';

    return `
      <div class="ingredient-row" ${rowAttribute}="${row.id}">
        <label>
          Alimento
          <select name="ingredientItem" required>
            <option value="">Selecciona</option>
            ${pantryItems.map((item) => `
              <option value="${item.id}" ${row.pantryItemId === item.id ? 'selected' : ''}>
                ${escapeHtml(item.name)} (${escapeHtml(item.unit)})
              </option>
            `).join('')}
          </select>
        </label>
        <label>
          Cantidad
          <input name="ingredientQuantity" type="number" inputmode="decimal" step="0.01" min="0.01" value="${row.quantity}" required />
        </label>
        <button class="icon-button ingredient-remove" type="button" aria-label="Quitar ingrediente" data-action="${removeAction}" data-id="${row.id}">
          ${this.renderIcon('delete')}
        </button>
      </div>
    `;
  },

  renderRecipeCreateSheet(dashboard) {
    if (!this.state.recipeFormOpen) {
      return '';
    }

    const draft = this.state.createRecipeDraft ?? {
      name: '',
      mealTypes: MEAL_TYPES,
    };

    return this.renderRecipeFormSheet({
      title: 'Crear receta',
      titleId: 'create-recipe-title',
      dismissAction: 'hide-recipe-form',
      dataForm: 'recipe',
      className: 'recipe-create-sheet',
      contextLabel: 'Nueva receta',
      contextTitle: 'Sin guardar',
      namePlaceholder: 'Ej. Lentejas rápidas',
      draft,
      rows: this.state.ingredientRows,
      pantryItems: dashboard.pantryItems,
      addIngredientAction: 'add-ingredient-row',
      submitLabel: 'Crear receta',
      submitIcon: 'add',
      submitDisabled: dashboard.pantryItems.length === 0,
    });
  },

  renderRecipeEditSheet(dashboard) {
    const recipe = dashboard.recipes.find((candidate) => candidate.id === this.state.editingRecipeId);

    if (!recipe) {
      return '';
    }

    return this.renderRecipeEditForm(recipe, dashboard.pantryItems);
  },

  renderRecipeEditForm(recipe, pantryItems) {
    const draft = this.state.editRecipeDraft ?? {
      name: recipe.name,
      mealTypes: recipe.mealTypes,
    };
    const rows = this.state.editIngredientRows.length > 0
      ? this.state.editIngredientRows
      : recipe.ingredients.map((ingredient) =>
          createIngredientRow({
            pantryItemId: ingredient.pantryItemId,
            quantity: String(ingredient.quantity),
          }),
        );

    return this.renderRecipeFormSheet({
      title: 'Editar receta',
      titleId: 'edit-recipe-title',
      dismissAction: 'cancel-edit-recipe',
      dataForm: 'recipe-edit',
      hiddenInputs: [{ name: 'recipeId', value: recipe.id }],
      contextLabel: 'Receta seleccionada',
      contextTitle: recipe.name,
      draft,
      rows,
      pantryItems,
      addIngredientAction: 'add-edit-ingredient-row',
      ingredientRowOptions: {
        rowAttribute: 'data-edit-ingredient-row',
        removeAction: 'remove-edit-ingredient-row',
      },
      submitLabel: 'Guardar cambios',
      submitIcon: 'save',
    });
  },

  renderRecipeFormSheet({
    title,
    titleId,
    dismissAction,
    dataForm,
    hiddenInputs = [],
    className = '',
    contextLabel,
    contextTitle,
    namePlaceholder = '',
    draft,
    rows,
    pantryItems,
    addIngredientAction,
    ingredientRowOptions = {},
    submitLabel,
    submitIcon,
    submitDisabled = false,
  }) {
    return this.renderActionSheet({
      title,
      titleId,
      dismissAction,
      className: `meal-edit-sheet entity-edit-sheet ${className}`,
      visibleTitle: true,
      form: {
        className: 'meal-edit-sheet-form entity-edit-sheet-form',
        dataForm,
        hiddenInputs,
      },
      body: `
        <div class="meal-edit-sheet-body entity-edit-sheet-body">
          ${this.renderSheetContext({
            icon: 'utensils',
            label: contextLabel,
            title: contextTitle,
          })}

          <label class="meal-edit-field">
            <span>Nombre</span>
            <input
              name="name"
              type="text"
              autocomplete="off"
              value="${escapeAttribute(draft.name)}"
              ${namePlaceholder ? `placeholder="${escapeAttribute(namePlaceholder)}"` : ''}
              required
            />
          </label>

          ${this.renderRecipeMealTypeFields(draft.mealTypes)}
          ${this.renderRecipeIngredientBuilder({
            rows,
            pantryItems,
            addIngredientAction,
            ingredientRowOptions,
          })}
        </div>
      `,
      footer: this.renderSheetActions({
        submitLabel,
        submitIcon,
        cancelAction: dismissAction,
        submitDisabled,
      }),
    });
  },

  renderRecipeMealTypeFields(selectedMealTypes) {
    return `
      <fieldset class="recipe-edit-meal-types">
        <legend>Momentos del dia</legend>
        <div class="recipe-edit-meal-type-row">
          ${MEAL_TYPES.map((mealType) => `
            <label class="checkbox-card">
              <input type="checkbox" name="mealTypes" value="${mealType}" ${selectedMealTypes.includes(mealType) ? 'checked' : ''} />
              <span>${MEAL_TYPE_LABELS[mealType]}</span>
            </label>
          `).join('')}
        </div>
      </fieldset>
    `;
  },

  renderRecipeIngredientBuilder({ rows, pantryItems, addIngredientAction, ingredientRowOptions }) {
    return `
      <div class="ingredient-builder recipe-edit-ingredients">
        <div class="section-heading compact">
          <h3>Ingredientes por racion</h3>
          <button class="button ghost small" type="button" data-action="${escapeAttribute(addIngredientAction)}" aria-label="Añadir ingrediente">
            ${this.renderIcon('add')}
          </button>
        </div>
        ${rows.map((row) => this.renderIngredientRow(row, pantryItems, ingredientRowOptions)).join('')}
      </div>
    `;
  },
};
