import { MEAL_TYPE_LABELS, MEAL_TYPES } from '../../domain/types.js';
import { createIngredientRow } from '../uiState.js';
import { escapeAttribute, escapeHtml, formatQuantity, matchesSearchText, normalizeSearchText } from '../renderUtils.js';

/**
 * Metodos de render y filtrado de la vista de recetas.
 */
export const recipeViewMethods = {
  filterRecipes(recipes, pantryItems) {
    const query = normalizeSearchText(this.state.recipeSearch);

    if (!query) {
      return recipes;
    }

    const pantryById = new Map(pantryItems.map((item) => [item.id, item]));

    return recipes.filter((recipe) =>
      matchesSearchText(recipe.name, query) ||
      recipe.ingredients.some((ingredient) => matchesSearchText(pantryById.get(ingredient.pantryItemId)?.name, query)),
    );
  },

  renderRecipesView(dashboard) {
    const filteredRecipes = this.filterRecipes(dashboard.recipes, dashboard.pantryItems);
    const isFormOpen = this.state.recipeFormOpen || dashboard.recipes.length === 0;

    return `
      <section class="panel action-panel ${isFormOpen ? '' : 'is-collapsed'}">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Cocina</p>
            <h2>Recetas</h2>
          </div>
          ${
            dashboard.recipes.length === 0
              ? '<span class="counter">0</span>'
              : `<button class="button ghost small" type="button" data-action="${isFormOpen ? 'hide-recipe-form' : 'show-recipe-form'}">
                  ${isFormOpen ? 'Ocultar' : 'Crear receta'}
                </button>`
          }
        </div>

        ${
          isFormOpen
            ? `
              <form class="stacked-form" data-form="recipe">
                <label>
                  Nombre
                  <input name="name" type="text" autocomplete="off" placeholder="Ej. Lentejas rápidas" required />
                </label>

                <fieldset class="choice-group">
                  <legend>Momentos del dia</legend>
                  ${MEAL_TYPES.map((mealType) => `
                    <label class="checkbox-card">
                      <input type="checkbox" name="mealTypes" value="${mealType}" checked />
                      <span>${MEAL_TYPE_LABELS[mealType]}</span>
                    </label>
                  `).join('')}
                </fieldset>

                <div class="ingredient-builder">
                  <div class="section-heading compact">
                    <h3>Ingredientes por racion</h3>
                    <button class="button ghost small" type="button" data-action="add-ingredient-row" aria-label="Añadir ingrediente">+</button>
                  </div>
                  ${this.state.ingredientRows.map((row) => this.renderIngredientRow(row, dashboard.pantryItems)).join('')}
                </div>

                <button class="button full" type="submit" ${dashboard.pantryItems.length === 0 ? 'disabled' : ''}>
                  Crear receta
                </button>
              </form>
            `
            : ''
        }
      </section>

      <section class="list-section" aria-label="Recetas guardadas">
        ${this.renderSearchControl({
          target: 'recipe',
          label: 'Buscar receta',
          placeholder: 'Ej. Lentejas o tomate',
          value: this.state.recipeSearch,
          visibleCount: filteredRecipes.length,
          totalCount: dashboard.recipes.length,
        })}
        ${dashboard.recipes.length === 0 ? this.renderEmptyState('Todavia no hay recetas.') : ''}
        ${
          dashboard.recipes.length > 0 && filteredRecipes.length === 0
            ? this.renderEmptyState('No hay recetas que coincidan.')
            : ''
        }
        ${filteredRecipes.map((recipe) => this.renderRecipe(recipe, dashboard.pantryItems)).join('')}
      </section>
    `;
  },

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
          x
        </button>
      </div>
    `;
  },

  renderRecipe(recipe, pantryItems) {
    if (this.state.editingRecipeId === recipe.id) {
      return this.renderRecipeEditForm(recipe, pantryItems);
    }

    const pantryById = new Map(pantryItems.map((item) => [item.id, item]));
    const ingredients = recipe.ingredients
      .map((ingredient) => {
        const item = pantryById.get(ingredient.pantryItemId);
        return item ? `${formatQuantity(ingredient.quantity)} ${escapeHtml(item.unit)} ${escapeHtml(item.name)}` : 'Ingrediente no encontrado';
      })
      .join(', ');

    return `
      <article class="list-card vertical">
        <div class="card-header">
          <div>
            <h3>${escapeHtml(recipe.name)}</h3>
            <p>${recipe.mealTypes.map((mealType) => MEAL_TYPE_LABELS[mealType]).join(' · ')}</p>
          </div>
          <div class="inline-actions">
            <button class="button ghost small" type="button" data-action="edit-recipe" data-id="${recipe.id}">
              Editar
            </button>
            <button class="icon-button" type="button" aria-label="Eliminar ${escapeAttribute(recipe.name)}" data-action="delete-recipe" data-id="${recipe.id}">
              x
            </button>
          </div>
        </div>
        <p class="muted">${ingredients}</p>
      </article>
    `;
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

    return `
      <article class="list-card vertical recipe-edit-card">
        <form class="stacked-form" data-form="recipe-edit">
          <input type="hidden" name="recipeId" value="${escapeAttribute(recipe.id)}" />
          <label>
            Nombre
            <input name="name" type="text" autocomplete="off" value="${escapeAttribute(draft.name)}" required />
          </label>

          <fieldset class="choice-group">
            <legend>Momentos del dia</legend>
            ${MEAL_TYPES.map((mealType) => `
              <label class="checkbox-card">
                <input type="checkbox" name="mealTypes" value="${mealType}" ${draft.mealTypes.includes(mealType) ? 'checked' : ''} />
                <span>${MEAL_TYPE_LABELS[mealType]}</span>
              </label>
            `).join('')}
          </fieldset>

          <div class="ingredient-builder">
            <div class="section-heading compact">
              <h3>Ingredientes por racion</h3>
              <button class="button ghost small" type="button" data-action="add-edit-ingredient-row" aria-label="Añadir ingrediente">+</button>
            </div>
            ${rows.map((row) =>
              this.renderIngredientRow(row, pantryItems, {
                rowAttribute: 'data-edit-ingredient-row',
                removeAction: 'remove-edit-ingredient-row',
              }),
            ).join('')}
          </div>

          <div class="form-actions">
            <button class="button" type="submit">Guardar</button>
            <button class="button ghost" type="button" data-action="cancel-edit-recipe">Cancelar</button>
          </div>
        </form>
      </article>
    `;
  }
};
