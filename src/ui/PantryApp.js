import { DomainError } from '../domain/errors.js';
import { fromISODate } from '../domain/planning.js';
import { DEFAULT_UNITS, MEAL_TYPE_LABELS, MEAL_TYPES } from '../domain/types.js';

/**
 * Controlador de UI de la SPA.
 *
 * Mantiene el estado minimo de interfaz y delega todas las reglas de negocio en
 * PantryService. Renderiza HTML declarativo porque el MVP no necesita un
 * framework de componentes.
 */
export class PantryApp {
  /**
   * @param {Object} params Dependencias.
   * @param {HTMLElement} params.root Nodo raiz de la aplicacion.
   * @param {import('../services/pantryService.js').PantryService} params.service Servicio de negocio.
   */
  constructor({ root, service }) {
    this.root = root;
    this.service = service;
    this.state = {
      activeView: 'pantry',
      dashboard: null,
      ingredientRows: [createIngredientRow()],
      toast: null,
      isBusy: false,
    };
  }

  /**
   * Carga datos iniciales, renderiza y registra eventos.
   *
   * @returns {Promise<void>}
   */
  async start() {
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('submit', (event) => this.handleSubmit(event));
    this.root.addEventListener('change', (event) => this.handleChange(event));
    await this.refresh();
  }

  /**
   * Recarga el snapshot agregado desde el servicio.
   *
   * @returns {Promise<void>}
   */
  async refresh() {
    this.state.dashboard = await this.service.getDashboard();
    this.render();
  }

  /**
   * Pinta la aplicacion completa.
   */
  render() {
    const dashboard = this.state.dashboard;

    if (!dashboard) {
      this.root.innerHTML = '<main class="app-shell"><p>Cargando...</p></main>';
      return;
    }

    this.root.innerHTML = `
      <div class="app-shell">
        <header class="app-header">
          <div>
            <p class="eyebrow">MVP local</p>
            <h1>Despensapp</h1>
          </div>
          <div class="header-stat" aria-label="Resumen de despensa">
            <strong>${dashboard.pantryItems.length}</strong>
            <span>alimentos</span>
          </div>
        </header>

        ${this.renderPendingMeals(dashboard)}
        ${this.renderToast()}

        <nav class="tabs" aria-label="Secciones principales">
          ${this.renderTab('pantry', 'Despensa')}
          ${this.renderTab('recipes', 'Recetas')}
          ${this.renderTab('plan', 'Plan')}
        </nav>

        <main>
          ${this.renderActiveView(dashboard)}
        </main>
      </div>
    `;
  }

  /**
   * Gestiona clicks de botones y navegacion.
   *
   * @param {MouseEvent} event Evento de click.
   * @returns {Promise<void>}
   */
  async handleClick(event) {
    const actionElement = event.target.closest('[data-action]');
    const viewElement = event.target.closest('[data-view]');

    if (viewElement) {
      this.state.activeView = viewElement.dataset.view;
      this.render();
      return;
    }

    if (!actionElement || this.state.isBusy) {
      return;
    }

    const { action, id } = actionElement.dataset;

    await this.runSafely(async () => {
      if (action === 'delete-pantry-item') {
        await this.service.deletePantryItem(id);
        this.showToast('Alimento eliminado.');
      }

      if (action === 'delete-recipe') {
        await this.service.deleteRecipe(id);
        this.showToast('Receta eliminada.');
      }

      if (action === 'delete-planned-meal') {
        await this.service.deletePlannedMeal(id);
        this.showToast('Comida eliminada del plan.');
      }

      if (action === 'clear-plan') {
        const deletedCount = await this.service.clearCurrentAndFutureMeals();
        this.showToast(`${deletedCount} comidas eliminadas del plan.`);
      }

      if (action === 'resolve-meal') {
        await this.service.resolvePastMeal(id, actionElement.dataset.cooked === 'true');
        this.showToast('Comida pendiente resuelta.');
      }

      if (action === 'add-ingredient-row') {
        this.state.ingredientRows.push(createIngredientRow());
      }

      if (action === 'remove-ingredient-row') {
        this.state.ingredientRows = this.state.ingredientRows.filter((row) => row.id !== id);

        if (this.state.ingredientRows.length === 0) {
          this.state.ingredientRows.push(createIngredientRow());
        }
      }

      await this.refresh();
    });
  }

  /**
   * Gestiona formularios de alta y planificacion.
   *
   * @param {SubmitEvent} event Evento de submit.
   * @returns {Promise<void>}
   */
  async handleSubmit(event) {
    event.preventDefault();

    const form = event.target;

    if (this.state.isBusy) {
      return;
    }

    await this.runSafely(async () => {
      if (form.matches('[data-form="pantry-item"]')) {
        const data = new FormData(form);
        await this.service.createPantryItem({
          name: data.get('name'),
          quantity: data.get('quantity'),
          unit: data.get('unit'),
        });
        form.reset();
        this.showToast('Alimento anadido.');
      }

      if (form.matches('[data-form="recipe"]')) {
        const data = new FormData(form);
        await this.service.createRecipe({
          name: data.get('name'),
          mealTypes: data.getAll('mealTypes'),
          ingredients: this.readIngredientsFromForm(data),
        });
        this.state.ingredientRows = [createIngredientRow()];
        this.showToast('Receta creada.');
      }

      if (form.matches('[data-form="plan-week"]')) {
        const data = new FormData(form);
        const mode = event.submitter?.dataset.planMode ?? 'reset';
        const result =
          mode === 'complete'
            ? await this.service.completeWeekPlan({ servings: data.get('servings') })
            : await this.service.planNextWeek({ servings: data.get('servings') });
        const skippedMessage =
          result.missingSlots.length > 0 ? ` ${result.missingSlots.length} huecos sin receta compatible.` : '';
        const createdMessage =
          mode === 'complete'
            ? `${result.plannedMeals.length} huecos completados.`
            : 'Semana planificada.';
        this.showToast(`${createdMessage}${skippedMessage}`);
      }

      if (form.matches('[data-form="planned-meal"]')) {
        const data = new FormData(form);
        await this.service.createPlannedMeal({
          date: data.get('date'),
          mealType: data.get('mealType'),
          recipeId: data.get('recipeId'),
          servings: data.get('servings'),
        });
        this.showToast('Comida anadida al plan.');
      }

      await this.refresh();
    });
  }

  /**
   * Mantiene el estado de filas dinamicas de ingredientes al cambiar selects.
   *
   * @param {Event} event Evento change.
   */
  handleChange(event) {
    const rowElement = event.target.closest('[data-ingredient-row]');

    if (!rowElement) {
      return;
    }

    const row = this.state.ingredientRows.find((ingredientRow) => ingredientRow.id === rowElement.dataset.ingredientRow);

    if (!row) {
      return;
    }

    if (event.target.matches('[name="ingredientItem"]')) {
      row.pantryItemId = event.target.value;
    }

    if (event.target.matches('[name="ingredientQuantity"]')) {
      row.quantity = event.target.value;
    }
  }

  /**
   * Ejecuta una accion atrapando errores de dominio para mostrarlos como aviso.
   *
   * @param {() => Promise<void>} action Accion asyncrona.
   * @returns {Promise<void>}
   */
  async runSafely(action) {
    this.state.isBusy = true;

    try {
      await action();
    } catch (error) {
      if (error instanceof DomainError) {
        this.showToast(error.message, 'error');
        this.render();
        return;
      }

      console.error(error);
      this.showToast('Ha ocurrido un error inesperado.', 'error');
      this.render();
    } finally {
      this.state.isBusy = false;
    }
  }

  /**
   * Lee ingredientes desde FormData preservando las filas dinamicas.
   *
   * @param {FormData} data Datos del formulario.
   * @returns {import('../domain/types.js').RecipeIngredient[]} Ingredientes.
   */
  readIngredientsFromForm(data) {
    const itemIds = data.getAll('ingredientItem');
    const quantities = data.getAll('ingredientQuantity');

    return itemIds.map((pantryItemId, index) => ({
      pantryItemId,
      quantity: quantities[index],
    }));
  }

  /**
   * Guarda un mensaje temporal para el siguiente render.
   *
   * @param {string} message Mensaje.
   * @param {'success' | 'error'} [type='success'] Tipo visual.
   */
  showToast(message, type = 'success') {
    this.state.toast = { message, type };
  }

  /**
   * Renderiza la vista seleccionada.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderActiveView(dashboard) {
    if (this.state.activeView === 'recipes') {
      return this.renderRecipesView(dashboard);
    }

    if (this.state.activeView === 'plan') {
      return this.renderPlanView(dashboard);
    }

    return this.renderPantryView(dashboard);
  }

  /**
   * Renderiza una pestana de navegacion.
   *
   * @param {string} view Nombre de vista.
   * @param {string} label Etiqueta.
   * @returns {string} HTML.
   */
  renderTab(view, label) {
    const isActive = this.state.activeView === view;
    return `
      <button class="tab ${isActive ? 'is-active' : ''}" type="button" data-view="${view}" aria-pressed="${isActive}">
        ${label}
      </button>
    `;
  }

  /**
   * Renderiza avisos de comidas pasadas pendientes.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPendingMeals(dashboard) {
    if (dashboard.pendingMeals.length === 0) {
      return '';
    }

    return `
      <section class="notice-panel" aria-label="Comidas pendientes">
        <div>
          <p class="eyebrow">Pendiente</p>
          <h2>Confirma comidas pasadas</h2>
        </div>
        <div class="pending-list">
          ${dashboard.pendingMeals.map((meal) => this.renderPendingMeal(meal, dashboard)).join('')}
        </div>
      </section>
    `;
  }

  /**
   * Renderiza una comida pendiente de confirmar.
   *
   * @param {import('../domain/types.js').PlannedMeal} meal Comida.
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPendingMeal(meal, dashboard) {
    const recipe = dashboard.recipes.find((candidate) => candidate.id === meal.recipeId);

    return `
      <article class="pending-card">
        <div>
          <strong>${formatDate(meal.date)} · ${MEAL_TYPE_LABELS[meal.mealType]}</strong>
          <span>${escapeHtml(recipe?.name ?? 'Receta eliminada')} · ${meal.servings} raciones</span>
        </div>
        <div class="inline-actions">
          <button class="button small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="true">
            Hecha
          </button>
          <button class="button ghost small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="false">
            No hecha
          </button>
        </div>
      </article>
    `;
  }

  /**
   * Renderiza el mensaje de estado.
   *
   * @returns {string} HTML.
   */
  renderToast() {
    if (!this.state.toast) {
      return '';
    }

    const toast = this.state.toast;
    this.state.toast = null;

    return `<p class="toast ${toast.type === 'error' ? 'is-error' : ''}" role="status">${escapeHtml(toast.message)}</p>`;
  }

  /**
   * Renderiza la vista de despensa.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPantryView(dashboard) {
    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Inventario</p>
            <h2>Despensa</h2>
          </div>
          <span class="counter">${dashboard.pantryItems.length}</span>
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
                ${DEFAULT_UNITS.map((unit) => `<option value="${unit}">${unit}</option>`).join('')}
              </select>
            </label>
          </div>
          <button class="button full" type="submit">Anadir alimento</button>
        </form>
      </section>

      <section class="list-section" aria-label="Alimentos guardados">
        ${dashboard.pantryItems.length === 0 ? this.renderEmptyState('Todavia no hay alimentos.') : ''}
        ${dashboard.pantryItems.map((item) => this.renderPantryItem(item)).join('')}
      </section>
    `;
  }

  /**
   * Renderiza un alimento.
   *
   * @param {import('../domain/types.js').PantryItem} item Alimento.
   * @returns {string} HTML.
   */
  renderPantryItem(item) {
    return `
      <article class="list-card">
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${formatQuantity(item.quantity)} ${escapeHtml(item.unit)}</p>
        </div>
        <button class="icon-button" type="button" aria-label="Eliminar ${escapeAttribute(item.name)}" data-action="delete-pantry-item" data-id="${item.id}">
          x
        </button>
      </article>
    `;
  }

  /**
   * Renderiza la vista de recetas.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderRecipesView(dashboard) {
    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Cocina</p>
            <h2>Recetas</h2>
          </div>
          <span class="counter">${dashboard.recipes.length}</span>
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
              <button class="button ghost small" type="button" data-action="add-ingredient-row">+</button>
            </div>
            ${this.state.ingredientRows.map((row) => this.renderIngredientRow(row, dashboard.pantryItems)).join('')}
          </div>

          <button class="button full" type="submit" ${dashboard.pantryItems.length === 0 ? 'disabled' : ''}>
            Crear receta
          </button>
        </form>
      </section>

      <section class="list-section" aria-label="Recetas guardadas">
        ${dashboard.recipes.length === 0 ? this.renderEmptyState('Todavia no hay recetas.') : ''}
        ${dashboard.recipes.map((recipe) => this.renderRecipe(recipe, dashboard.pantryItems)).join('')}
      </section>
    `;
  }

  /**
   * Renderiza una fila dinamica de ingrediente.
   *
   * @param {{id: string, pantryItemId: string, quantity: string}} row Estado de fila.
   * @param {import('../domain/types.js').PantryItem[]} pantryItems Alimentos.
   * @returns {string} HTML.
   */
  renderIngredientRow(row, pantryItems) {
    return `
      <div class="ingredient-row" data-ingredient-row="${row.id}">
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
        <button class="icon-button ingredient-remove" type="button" aria-label="Quitar ingrediente" data-action="remove-ingredient-row" data-id="${row.id}">
          x
        </button>
      </div>
    `;
  }

  /**
   * Renderiza una receta.
   *
   * @param {import('../domain/types.js').Recipe} recipe Receta.
   * @param {import('../domain/types.js').PantryItem[]} pantryItems Alimentos.
   * @returns {string} HTML.
   */
  renderRecipe(recipe, pantryItems) {
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
          <button class="icon-button" type="button" aria-label="Eliminar ${escapeAttribute(recipe.name)}" data-action="delete-recipe" data-id="${recipe.id}">
            x
          </button>
        </div>
        <p class="muted">${ingredients}</p>
      </article>
    `;
  }

  /**
   * Renderiza la vista de planificacion.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPlanView(dashboard) {
    return `
      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Siguiente semana</p>
            <h2>Planificacion</h2>
          </div>
          <span class="counter">${dashboard.plannedMeals.length}</span>
        </div>

        <form class="plan-actions" data-form="plan-week">
          <label>
            Raciones por comida
            <input name="servings" type="number" inputmode="decimal" min="0.5" step="0.5" value="1" required />
          </label>
          <button class="button" type="submit" data-plan-mode="reset">Planificar semana</button>
          <button class="button ghost" type="submit" data-plan-mode="complete">Completar huecos</button>
          <button class="button ghost" type="button" data-action="clear-plan">Vaciar plan</button>
        </form>
      </section>

      ${this.renderShoppingList(dashboard)}

      <section class="list-section" aria-label="Comidas planificadas">
        ${dashboard.plannedMeals.length === 0 ? this.renderEmptyState('Aun no hay comidas planificadas.') : ''}
        ${this.renderPlanGroups(dashboard)}
      </section>
    `;
  }

  /**
   * Renderiza lista de compra agregada.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderShoppingList(dashboard) {
    if (dashboard.plannedMeals.length === 0) {
      return '';
    }

    if (dashboard.shoppingList.length === 0) {
      return `
        <section class="status-panel ok">
          <strong>Tienes alimentos suficientes para el plan actual.</strong>
        </section>
      `;
    }

    return `
      <section class="status-panel">
        <div class="section-heading compact">
          <h3>Lista de la compra</h3>
          <span class="counter">${dashboard.shoppingList.length}</span>
        </div>
        <ul class="shopping-list">
          ${dashboard.shoppingList.map((item) => `
            <li>
              <span>${escapeHtml(item.name)}</span>
              <strong>${formatQuantity(item.missingQuantity)} ${escapeHtml(item.unit)}</strong>
            </li>
          `).join('')}
        </ul>
      </section>
    `;
  }

  /**
   * Agrupa la planificacion por dia.
   *
   * @param {import('../domain/types.js').DashboardSnapshot} dashboard Snapshot.
   * @returns {string} HTML.
   */
  renderPlanGroups(dashboard) {
    if (dashboard.plannedMeals.length === 0) {
      return '';
    }

    const groups = new Map();

    for (const meal of dashboard.plannedMeals) {
      if (!groups.has(meal.date)) {
        groups.set(meal.date, []);
      }

      groups.get(meal.date).push(meal);
    }

    for (const slot of dashboard.missingPlanSlots) {
      if (!groups.has(slot.date)) {
        groups.set(slot.date, []);
      }
    }

    return [...groups.entries()]
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .map(([date, meals]) => `
        <section class="day-group">
          <h3>${formatDate(date)}</h3>
          ${meals.map((meal) => this.renderPlannedMeal(meal, dashboard.recipes)).join('')}
          ${dashboard.missingPlanSlots
            .filter((slot) => slot.date === date)
            .map((slot) => this.renderMissingMealSlot(slot, dashboard.recipes))
            .join('')}
        </section>
      `)
      .join('');
  }

  /**
   * Renderiza una comida planificada.
   *
   * @param {import('../domain/types.js').PlannedMeal} meal Comida.
   * @param {import('../domain/types.js').Recipe[]} recipes Recetas.
   * @returns {string} HTML.
   */
  renderPlannedMeal(meal, recipes) {
    const recipe = recipes.find((candidate) => candidate.id === meal.recipeId);

    return `
      <article class="meal-card">
        <div>
          <span>${MEAL_TYPE_LABELS[meal.mealType]}</span>
          <strong>${escapeHtml(recipe?.name ?? 'Receta eliminada')}</strong>
          <small>${meal.servings} raciones</small>
        </div>
        <button class="icon-button" type="button" aria-label="Eliminar comida" data-action="delete-planned-meal" data-id="${meal.id}">
          x
        </button>
      </article>
    `;
  }

  /**
   * Renderiza un hueco libre para anadir una comida compatible.
   *
   * @param {import('../domain/types.js').MealSlot} slot Hueco sin comida.
   * @param {import('../domain/types.js').Recipe[]} recipes Recetas disponibles.
   * @returns {string} HTML.
   */
  renderMissingMealSlot(slot, recipes) {
    const compatibleRecipes = recipes.filter((recipe) => recipe.mealTypes.includes(slot.mealType));

    if (compatibleRecipes.length === 0) {
      return `
        <article class="missing-meal-card">
          <div>
            <span>${MEAL_TYPE_LABELS[slot.mealType]}</span>
            <strong>Sin receta compatible</strong>
          </div>
        </article>
      `;
    }

    return `
      <form class="missing-meal-card" data-form="planned-meal">
        <input type="hidden" name="date" value="${escapeAttribute(slot.date)}" />
        <input type="hidden" name="mealType" value="${escapeAttribute(slot.mealType)}" />
        <label>
          ${MEAL_TYPE_LABELS[slot.mealType]}
          <select name="recipeId" required>
            ${compatibleRecipes.map((recipe) => `
              <option value="${escapeAttribute(recipe.id)}">${escapeHtml(recipe.name)}</option>
            `).join('')}
          </select>
        </label>
        <label>
          Raciones
          <input name="servings" type="number" inputmode="decimal" min="0.5" step="0.5" value="1" required />
        </label>
        <button class="button small" type="submit">Anadir</button>
      </form>
    `;
  }

  /**
   * Renderiza un estado vacio reutilizable.
   *
   * @param {string} text Texto.
   * @returns {string} HTML.
   */
  renderEmptyState(text) {
    return `<p class="empty-state">${text}</p>`;
  }
}

/**
 * Crea una fila de ingrediente para el formulario.
 *
 * @returns {{id: string, pantryItemId: string, quantity: string}} Estado inicial.
 */
function createIngredientRow() {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()),
    pantryItemId: '',
    quantity: '',
  };
}

/**
 * Formatea cantidades evitando decimales innecesarios.
 *
 * @param {number} value Cantidad.
 * @returns {string} Cantidad visible.
 */
function formatQuantity(value) {
  return new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formatea fechas para lectura en movil.
 *
 * @param {string} isoDate Fecha YYYY-MM-DD.
 * @returns {string} Fecha visible.
 */
function formatDate(isoDate) {
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(fromISODate(isoDate));
}

/**
 * Escapa texto dinamico antes de insertarlo en plantillas HTML.
 *
 * @param {unknown} value Valor dinamico.
 * @returns {string} Texto seguro para contenido HTML.
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Escapa texto dinamico usado en atributos HTML.
 *
 * @param {unknown} value Valor dinamico.
 * @returns {string} Texto seguro para atributo.
 */
function escapeAttribute(value) {
  return escapeHtml(value);
}
