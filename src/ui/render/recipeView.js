import { MEAL_TYPE_LABELS, MEAL_TYPES } from '../../domain/types.js';
import { createIngredientRow } from '../uiState.js';
import { escapeAttribute, escapeHtml, matchesSearchText, normalizeSearchText } from '../renderUtils.js';

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
      <section class="view-heading">
        <div>
          <h2>Recetas</h2>
          <p>${dashboard.recipes.length} recetas disponibles</p>
        </div>
        ${
          dashboard.recipes.length === 0
            ? ''
            : `<button class="button ghost small" type="button" data-action="${isFormOpen ? 'hide-recipe-form' : 'show-recipe-form'}">
                ${isFormOpen ? 'Ocultar' : `${this.renderIcon('add')} Crear`}
              </button>`
        }
      </section>

      ${this.renderSearchControl({
        target: 'recipe',
        label: 'Buscar receta',
        placeholder: 'Buscar recetas...',
        value: this.state.recipeSearch,
        visibleCount: filteredRecipes.length,
        totalCount: dashboard.recipes.length,
      })}

      ${
        isFormOpen
          ? `
            <section class="panel action-panel recipe-form-panel">
              <div class="section-heading compact">
                <h3>Crear receta</h3>
              </div>
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
                    <button class="button ghost small" type="button" data-action="add-ingredient-row" aria-label="Añadir ingrediente">${this.renderIcon('add')}</button>
                  </div>
                  ${this.state.ingredientRows.map((row) => this.renderIngredientRow(row, dashboard.pantryItems)).join('')}
                </div>

                <button class="button full" type="submit" ${dashboard.pantryItems.length === 0 ? 'disabled' : ''}>
                  ${this.renderIcon('add')} Crear receta
                </button>
              </form>
            </section>
          `
          : ''
      }

      <section class="list-section" aria-label="Recetas guardadas">
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
          ${this.renderIcon('delete')}
        </button>
      </div>
    `;
  },

  renderRecipe(recipe, pantryItems) {
    if (this.state.editingRecipeId === recipe.id) {
      return this.renderRecipeEditForm(recipe, pantryItems);
    }

    return `
      <article class="list-card recipe-card">
        <span class="recipe-icon-tile" aria-hidden="true">${this.renderIcon('utensils')}</span>
        <div class="recipe-card-copy">
          <h3>${escapeHtml(recipe.name)}</h3>
          <div class="meal-badge-row">
            ${recipe.mealTypes.map((mealType) => this.renderMealTypeBadge(mealType)).join('')}
          </div>
        </div>
        <div class="inline-actions recipe-card-actions">
          <button class="meal-icon-action" type="button" aria-label="Editar ${escapeAttribute(recipe.name)}" data-action="edit-recipe" data-id="${recipe.id}">
            ${this.renderIcon('edit')}
          </button>
          <button class="icon-button" type="button" aria-label="Eliminar ${escapeAttribute(recipe.name)}" data-action="delete-recipe" data-id="${recipe.id}">
            ${this.renderIcon('delete')}
          </button>
        </div>
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
              <button class="button ghost small" type="button" data-action="add-edit-ingredient-row" aria-label="Añadir ingrediente">${this.renderIcon('add')}</button>
            </div>
            ${rows.map((row) =>
              this.renderIngredientRow(row, pantryItems, {
                rowAttribute: 'data-edit-ingredient-row',
                removeAction: 'remove-edit-ingredient-row',
              }),
            ).join('')}
          </div>

          <div class="form-actions">
            <button class="button" type="submit">${this.renderIcon('save')} Guardar</button>
            <button class="button ghost" type="button" data-action="cancel-edit-recipe">Cancelar</button>
          </div>
        </form>
      </article>
    `;
  }
};
