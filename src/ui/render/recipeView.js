import { recipeFormRenderMethods } from './recipeFormView.js';
import { recipeIngredientStatusRenderMethods } from './recipeIngredientStatusView.js';
import { recipeListRenderMethods } from './recipeListView.js';

/**
 * Metodos de render de la pantalla principal de recetas.
 */
export const recipeViewMethods = {
  renderRecipesView(dashboard) {
    const filteredRecipes = this.filterRecipes(dashboard.recipes, dashboard.pantryItems);
    const isFormOpen = this.state.recipeFormOpen;

    return `
      <section class="view-heading">
        <div>
          <h2>Recetas</h2>
          <p>${dashboard.recipes.length} recetas disponibles</p>
        </div>
      </section>

      ${this.renderSearchControl({
        target: 'recipe',
        label: 'Buscar receta',
        placeholder: 'Buscar recetas...',
        value: this.state.recipeSearch,
        visibleCount: filteredRecipes.length,
        totalCount: dashboard.recipes.length,
      })}

      ${this.renderRecipeCreateSheet(dashboard)}
      ${this.renderRecipeIngredientsSheet(dashboard)}
      ${this.renderRecipeEditSheet(dashboard)}
      ${this.renderRecipeDeleteSheet(dashboard)}
      ${
        isFormOpen
          ? ''
          : this.renderFloatingActionButton({
              action: 'show-recipe-form',
              label: 'Crear receta',
            })
      }

      <section class="list-section" aria-label="Recetas guardadas">
        ${dashboard.recipes.length === 0 ? this.renderEmptyState('Todavia no hay recetas.') : ''}
        ${
          dashboard.recipes.length > 0 && filteredRecipes.length === 0
            ? this.renderEmptyState('No hay recetas que coincidan.')
            : ''
        }
        ${filteredRecipes.map((recipe) => this.renderRecipe(recipe)).join('')}
      </section>
    `;
  },

  renderRecipeDeleteSheet(dashboard) {
    const recipe = dashboard.recipes.find((candidate) => candidate.id === this.state.deletingRecipeId);

    if (!recipe) {
      return '';
    }

    return this.renderDeleteConfirmationSheet({
      title: 'Borrar receta',
      titleId: 'delete-recipe-title',
      dismissAction: 'cancel-delete-recipe',
      itemLabel: 'Receta seleccionada',
      itemName: recipe.name,
      question: '¿Quieres borrar esta receta?',
      confirmLabel: 'Borrar receta',
      confirmAction: 'confirm-delete-recipe',
      itemId: recipe.id,
    });
  },

  ...recipeListRenderMethods,
  ...recipeIngredientStatusRenderMethods,
  ...recipeFormRenderMethods,
};
