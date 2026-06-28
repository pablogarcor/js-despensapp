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
      <section class="view-heading">
        <div>
          <h2>Despensa</h2>
          <p>${dashboard.pantryItems.length} alimentos guardados</p>
        </div>
        ${
          dashboard.pantryItems.length === 0
            ? ''
            : `<button class="button ghost small" type="button" data-action="${isFormOpen ? 'hide-pantry-form' : 'show-pantry-form'}">
                ${isFormOpen ? 'Ocultar' : `${this.renderIcon('add')} Añadir`}
              </button>`
        }
      </section>

      ${this.renderSearchControl({
        target: 'pantry',
        label: 'Buscar alimento',
        placeholder: 'Buscar en despensa...',
        value: this.state.pantrySearch,
        visibleCount: filteredPantryItems.length,
        totalCount: dashboard.pantryItems.length,
      })}

      ${
        isFormOpen
          ? `
            <section class="panel action-panel pantry-form-panel">
              <div class="section-heading compact">
                <h3>Añadir alimento</h3>
              </div>
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
                <button class="button full" type="submit">${this.renderIcon('add')} Añadir alimento</button>
              </form>
            </section>
          `
          : ''
      }

      <section class="list-section" aria-label="Alimentos guardados">
        ${
          dashboard.pantryItems.length === 0 ? this.renderEmptyState('Todavia no hay alimentos.') : ''
        }
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
            <div class="item-title-row">
              <h3>${escapeHtml(item.name)}</h3>
              ${renderStockBadge(item)}
            </div>
            <p>${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</p>
          </div>
          <div class="inline-actions">
            <button class="button ghost small icon-label-button" type="button" data-action="edit-pantry-item" data-id="${item.id}">
              ${this.renderIcon('edit')} <span>Editar</span>
            </button>
            <button class="icon-button" type="button" aria-label="Eliminar ${escapeAttribute(item.name)}" data-action="delete-pantry-item" data-id="${item.id}">
              ${this.renderIcon('delete')}
            </button>
          </div>
        </div>
        <form class="stock-form" data-form="pantry-stock">
          <input type="hidden" name="pantryItemId" value="${escapeAttribute(item.id)}" />
          <label class="stock-adjust-label">
            <span>Ajuste</span>
            <input name="quantity" type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0" required />
          </label>
          <div class="stock-actions">
            <button class="button small" type="submit" data-stock-action="subtract">${this.renderIcon('stockMinus')} Restar</button>
            <button class="button small" type="submit" data-stock-action="add">${this.renderIcon('stockPlus')} Sumar</button>
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
            <button class="button" type="submit">${this.renderIcon('save')} Guardar</button>
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

/**
 * Renderiza una etiqueta visual de estado de stock sin cambiar reglas de negocio.
 *
 * @param {import('../../domain/types.js').PantryItem} item Alimento.
 * @returns {string} HTML de la etiqueta o cadena vacia.
 */
function renderStockBadge(item) {
  if (item.quantity <= 0) {
    return '<span class="stock-badge is-empty">Agotado</span>';
  }

  if (item.quantity <= 1) {
    return '<span class="stock-badge is-low">Bajo stock</span>';
  }

  return '';
}
