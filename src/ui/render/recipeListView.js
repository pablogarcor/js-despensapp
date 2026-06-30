import { escapeAttribute, escapeHtml, matchesSearchText, normalizeSearchText } from '../renderUtils.js';

/**
 * Metodos de filtrado y tarjetas de recetas.
 */
export const recipeListRenderMethods = {
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

  renderRecipe(recipe) {
    return `
      <article
        class="list-card recipe-card"
        role="button"
        tabindex="0"
        data-action="view-recipe-ingredients"
        data-id="${escapeAttribute(recipe.id)}"
        aria-label="Ver ingredientes de ${escapeAttribute(recipe.name)}"
      >
        <span class="recipe-icon-tile" aria-hidden="true">${this.renderIcon('utensils')}</span>
        <div class="recipe-card-copy">
          <h3>${escapeHtml(recipe.name)}</h3>
          <div class="meal-badge-row">
            ${recipe.mealTypes.map((mealType) => this.renderMealTypeBadge(mealType)).join('')}
          </div>
        </div>
        ${this.renderEditDeleteActions({
          id: recipe.id,
          editAction: 'edit-recipe',
          deleteAction: 'delete-recipe',
          editLabel: `Editar ${recipe.name}`,
          deleteLabel: `Eliminar ${recipe.name}`,
          className: 'recipe-card-actions',
        })}
      </article>
    `;
  },
};
