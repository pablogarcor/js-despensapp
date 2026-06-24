import { escapeAttribute, escapeHtml, formatQuantity, matchesSearchText, normalizeSearchText, renderUnitOptions } from '../renderUtils.js';

/**
 * Metodos de render y filtrado de la vista de despensa.
 */
export const pantryViewMethods = {
  filterPantryItems(pantryItems) {
    const query = normalizeSearchText(this.state.pantrySearch);

    if (!query) {
      return pantryItems;
    }

    return pantryItems.filter((item) => matchesSearchText(item.name, query));
  },

  renderPantryView(dashboard) {
    const filteredPantryItems = this.filterPantryItems(dashboard.pantryItems);
    const isFormOpen = this.state.pantryFormOpen || dashboard.pantryItems.length === 0;

    return `
      <section class="panel action-panel ${isFormOpen ? '' : 'is-collapsed'}">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Inventario</p>
            <h2>Despensa</h2>
          </div>
          ${
            dashboard.pantryItems.length === 0
              ? '<span class="counter">0</span>'
              : `<button class="button ghost small" type="button" data-action="${isFormOpen ? 'hide-pantry-form' : 'show-pantry-form'}">
                  ${isFormOpen ? 'Ocultar' : 'Añadir alimento'}
                </button>`
          }
        </div>

        ${
          isFormOpen
            ? `
              <form class="stacked-form" data-form="pantry-item">
                <label>
                  Nombre
                  <input name="name" type="text" autocomplete="off" placeholder="Ej. Garbanzos" required />
                </label>
                <div class="form-grid">
                  <label>
                    Cantidad
                    <input name="quantity" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0" required />
                  </label>
                  <label>
                    Unidad
                    <select name="unit" required>
                      ${renderUnitOptions()}
                    </select>
                  </label>
                </div>
                <button class="button full" type="submit">Añadir alimento</button>
              </form>
            `
            : ''
        }
      </section>

      <section class="list-section" aria-label="Alimentos guardados">
        ${this.renderSearchControl({
          target: 'pantry',
          label: 'Buscar alimento',
          placeholder: 'Ej. Garbanzos',
          value: this.state.pantrySearch,
          visibleCount: filteredPantryItems.length,
          totalCount: dashboard.pantryItems.length,
        })}
        ${dashboard.pantryItems.length === 0 ? this.renderEmptyState('Todavia no hay alimentos.') : ''}
        ${
          dashboard.pantryItems.length > 0 && filteredPantryItems.length === 0
            ? this.renderEmptyState('No hay alimentos que coincidan.')
            : ''
        }
        ${filteredPantryItems.map((item) => this.renderPantryItem(item, dashboard.recipes)).join('')}
      </section>
    `;
  },

  renderPantryItem(item, recipes) {
    if (this.state.editingPantryItemId === item.id) {
      return this.renderPantryItemEditForm(item, recipes);
    }

    return `
      <article class="list-card pantry-card">
        <div class="pantry-card-main">
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</p>
          </div>
          <div class="inline-actions">
            <button class="button ghost small" type="button" data-action="edit-pantry-item" data-id="${item.id}">
              Editar
            </button>
            <button class="icon-button" type="button" aria-label="Eliminar ${escapeAttribute(item.name)}" data-action="delete-pantry-item" data-id="${item.id}">
              x
            </button>
          </div>
        </div>
        <form class="stock-form" data-form="pantry-stock">
          <input type="hidden" name="pantryItemId" value="${escapeAttribute(item.id)}" />
          <label>
            Ajustar ${escapeHtml(item.unit)}
            <input name="quantity" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0" required />
          </label>
          <div class="stock-actions">
            <button class="button small" type="submit" data-stock-action="add">Sumar</button>
            <button class="button ghost small" type="submit" data-stock-action="subtract">Restar</button>
          </div>
        </form>
      </article>
    `;
  },

  renderPantryItemEditForm(item, recipes) {
    const affectedRecipes = recipes.filter((recipe) =>
      recipe.ingredients.some((ingredient) => ingredient.pantryItemId === item.id),
    );

    return `
      <article class="list-card pantry-card pantry-edit-card">
        <form class="stacked-form" data-form="pantry-item-edit">
          <input type="hidden" name="pantryItemId" value="${escapeAttribute(item.id)}" />
          <label>
            Nombre
            <input name="name" type="text" autocomplete="off" value="${escapeAttribute(item.name)}" required />
          </label>
          <div class="form-grid">
            <label>
              Cantidad
              <input name="quantity" type="number" inputmode="decimal" step="0.01" min="0" value="${item.quantity}" required />
            </label>
            <label>
              Unidad
              <select name="unit" required>
                ${renderUnitOptions(item.unit)}
              </select>
            </label>
          </div>
          ${this.renderPantryRecipeUsageFields(item, affectedRecipes)}
          <div class="form-actions">
            <button class="button" type="submit">Guardar</button>
            <button class="button ghost" type="button" data-action="cancel-edit-pantry-item">Cancelar</button>
          </div>
        </form>
      </article>
    `;
  },

  renderPantryRecipeUsageFields(item, affectedRecipes) {
    if (affectedRecipes.length === 0) {
      return '';
    }

    return `
      <div class="recipe-usage-editor">
        <div class="section-heading compact">
          <h3>Recetas que usan ${escapeHtml(item.name)}</h3>
        </div>
        ${affectedRecipes.map((recipe) => {
          const ingredient = recipe.ingredients.find((candidate) => candidate.pantryItemId === item.id);

          return `
            <div class="recipe-usage-row">
              <input type="hidden" name="recipeIngredientRecipeId" value="${escapeAttribute(recipe.id)}" />
              <label>
                ${escapeHtml(recipe.name)}
                <input
                  name="recipeIngredientQuantity"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  min="0.01"
                  value="${ingredient.quantity}"
                  required
                />
              </label>
              <span>${formatQuantity(ingredient.quantity)} ${escapeHtml(item.unit)} actuales</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }
};
