import { escapeHtml, formatQuantity } from '../renderUtils.js';

/**
 * Metodos de render para consultar ingredientes y disponibilidad de una receta.
 */
export const recipeIngredientStatusRenderMethods = {
  renderRecipeIngredientsSheet(dashboard) {
    const recipe = dashboard.recipes.find((candidate) => candidate.id === this.state.viewingRecipeId);

    if (!recipe) {
      return '';
    }

    const pantryById = new Map(dashboard.pantryItems.map((item) => [item.id, item]));

    return this.renderActionSheet({
      title: recipe.name,
      titleId: 'recipe-ingredients-title',
      dismissAction: 'hide-recipe-ingredients',
      className: 'meal-edit-sheet recipe-ingredients-sheet',
      visibleTitle: true,
      body: `
        <div class="meal-edit-sheet-body recipe-ingredients-sheet-body">
          <h3 class="recipe-ingredients-heading">Ingredientes</h3>
          <div class="recipe-ingredient-status-list">
            ${recipe.ingredients.map((ingredient) => this.renderRecipeIngredientStatus(ingredient, pantryById)).join('')}
          </div>
        </div>
      `,
    });
  },

  renderRecipeIngredientStatus(ingredient, pantryById) {
    const item = pantryById.get(ingredient.pantryItemId);
    const requiredQuantity = Number(ingredient.quantity);
    const availableQuantity = Number(item?.quantity ?? 0);
    const missingQuantity = Math.max(requiredQuantity - availableQuantity, 0);
    const hasEnough = Boolean(item) && missingQuantity <= 0;
    const unit = item?.unit ?? '';
    const itemName = item?.name ?? 'Ingrediente no encontrado';
    const statusClass = hasEnough ? 'is-available' : 'is-missing';
    const statusIcon = hasEnough ? 'check' : 'warning';
    const amount = hasEnough ? requiredQuantity : missingQuantity;
    const detail = [
      `Stock: ${formatIngredientAmount(availableQuantity, unit)}`,
      `Necesario: ${formatIngredientAmount(requiredQuantity, unit)}`,
      ...(hasEnough ? [] : [`Faltan ${formatIngredientAmount(missingQuantity, unit)}`]),
    ].join(' / ');

    return `
      <article class="recipe-ingredient-status-card ${statusClass}">
        <span class="recipe-ingredient-status-icon" aria-hidden="true">${this.renderIcon(statusIcon)}</span>
        <div class="recipe-ingredient-status-copy">
          <div class="recipe-ingredient-status-title">
            <strong>${escapeHtml(itemName)}</strong>
            ${hasEnough ? '' : '<span>Falta</span>'}
          </div>
          <p>${escapeHtml(detail)}</p>
        </div>
        <strong class="recipe-ingredient-status-amount">${escapeHtml(formatIngredientAmount(amount, unit))}</strong>
      </article>
    `;
  },
};

/**
 * Formatea una cantidad de ingrediente con su unidad.
 *
 * @param {number} quantity Cantidad a mostrar.
 * @param {string} unit Unidad del alimento.
 * @returns {string} Cantidad formateada.
 */
function formatIngredientAmount(quantity, unit) {
  const formattedQuantity = formatQuantity(quantity);

  return unit ? `${formattedQuantity} ${unit}` : formattedQuantity;
}
