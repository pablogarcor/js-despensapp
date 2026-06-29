import { MEAL_TYPE_LABELS } from '../../domain/types.js';
import { escapeAttribute, escapeHtml, formatDate } from '../renderUtils.js';

/**
 * Metodos de render compartidos por varias vistas.
 */
export const commonRenderMethods = {
  renderIcon(name) {
    return renderIcon(name);
  },

  renderActionSheet(options) {
    return renderActionSheet(options);
  },

  renderTab(view, label) {
    const isActive = this.state.activeView === view;
    return `
      <button class="tab ${isActive ? 'is-active' : ''}" type="button" data-view="${view}" aria-pressed="${isActive}" ${isActive ? 'aria-current="page"' : ''}>
        ${renderIcon(TAB_ICONS[view] ?? 'calendar')}
        <span>${label}</span>
      </button>
    `;
  },

  renderMealTypeBadge(mealType, extraClass = '') {
    return `<span class="meal-type-badge meal-type-${mealType} ${extraClass}">${MEAL_TYPE_LABELS[mealType]}</span>`;
  },

  renderPendingMeals(dashboard) {
    if (dashboard.pendingMeals.length === 0) {
      return '';
    }

    return `
      <section class="notice-panel" aria-label="Comidas pendientes">
        <div>
          <p class="eyebrow">Pendiente</p>
          <h2>Confirmar comidas</h2>
          <p>¿Has cocinado estas comidas?</p>
        </div>
        <div class="pending-list">
          ${dashboard.pendingMeals.map((meal) => this.renderPendingMeal(meal, dashboard)).join('')}
        </div>
      </section>
    `;
  },

  renderPendingMeal(meal, dashboard) {
    const recipe = dashboard.recipes.find((candidate) => candidate.id === meal.recipeId);
    const isNote = meal.kind === 'note';

    return `
      <article class="pending-card ${isNote ? 'note-pending-card' : ''}">
        <div class="pending-card-copy">
          <span class="pending-date">${formatDate(meal.date)} · ${MEAL_TYPE_LABELS[meal.mealType]}</span>
          <strong>
            ${isNote ? escapeHtml(meal.title) : escapeHtml(recipe?.name ?? 'Receta eliminada')}
          </strong>
          <span>
            ${
              isNote
                ? (meal.note ? escapeHtml(meal.note) : 'Nota de plan')
                : `${meal.servings} raciones`
            }
          </span>
        </div>
        <div class="inline-actions">
          ${
            isNote
              ? `
                <button class="button small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="false">
                  Resolver
                </button>
              `
              : `
                <button class="button small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="true">
                  ${renderIcon('done')} Hecha
                </button>
                <button class="button ghost small" type="button" data-action="resolve-meal" data-id="${meal.id}" data-cooked="false">
                  ${renderIcon('skipped')} No hecha
                </button>
              `
          }
        </div>
      </article>
    `;
  },

  renderToast() {
    if (!this.state.toast) {
      return '';
    }

    const toast = this.state.toast;
    const role = toast.type === 'error' ? 'alert' : 'status';

    return `
      <div class="toast ${toast.type === 'error' ? 'is-error' : ''}" role="${role}" aria-live="${toast.type === 'error' ? 'assertive' : 'polite'}">
        <span>${escapeHtml(toast.message)}</span>
        <button class="toast-close" type="button" data-action="dismiss-toast" aria-label="Cerrar aviso">${renderIcon('close')}</button>
      </div>
    `;
  },

  renderSearchControl({ target, label, placeholder, value, visibleCount, totalCount }) {
    if (totalCount === 0) {
      return '';
    }

    const clearAction = target === 'pantry' ? 'clear-pantry-search' : 'clear-recipe-search';

    return `
      <div class="search-toolbar" role="search">
        <div class="search-row">
          <label class="search-field">
            <span class="search-label-row">
              <span class="visually-hidden">${label}</span>
              <small>${visibleCount} de ${totalCount}</small>
            </span>
            <span class="search-icon" aria-hidden="true">${renderIcon('search')}</span>
            <input
              type="search"
              data-search="${target}"
              autocomplete="off"
              placeholder="${escapeAttribute(placeholder)}"
              value="${escapeAttribute(value)}"
              aria-label="${escapeAttribute(label)}"
            />
          </label>
          ${
            value
              ? `<button class="search-clear" type="button" data-action="${clearAction}" aria-label="Limpiar busqueda">${renderIcon('close')}</button>`
              : ''
          }
        </div>
      </div>
    `;
  },

  renderEmptyState(text) {
    return `<p class="empty-state">${text}</p>`;
  }
};

const TAB_ICONS = Object.freeze({
  plan: 'weeklyPlan',
  pantry: 'pantry',
  recipes: 'recipes',
  shopping: 'shoppingList',
});

/**
 * Renderiza una hoja modal inferior reusable para grupos de acciones.
 *
 * @param {{
 *   title: string,
 *   titleId?: string,
 *   dismissAction: string,
 *   className?: string,
 *   visibleTitle?: boolean,
 *   form?: {
 *     className?: string,
 *     dataForm?: string,
 *     hiddenInputs?: Array<{ name: string, value: string }>
 *   },
 *   body?: string,
 *   footer?: string,
 *   actions?: Array<{
 *     label: string,
 *     icon: string,
 *     type?: string,
 *     action?: string,
 *     variant?: string,
 *     data?: Record<string, string>,
 *     separated?: boolean
 *   }>
 * }} options Configuracion de la hoja.
 * @returns {string} HTML de la hoja.
 */
function renderActionSheet({
  title,
  titleId = 'action-sheet-title',
  dismissAction,
  className = '',
  visibleTitle = false,
  form,
  body = '',
  footer = '',
  actions = [],
}) {
  const list = actions.length > 0
    ? `
      <div class="action-sheet-list">
        ${actions.map(renderActionSheetAction).join('')}
      </div>
    `
    : '';
  const content = `
    ${renderActionSheetHiddenInputs(form?.hiddenInputs ?? [])}
    ${body}
    ${list}
    ${footer}
  `;
  const formAttributes = form ? renderActionSheetFormAttributes(form) : '';
  const sheetClass = ['action-sheet', visibleTitle ? 'has-visible-title' : '', className]
    .filter(Boolean)
    .join(' ');
  const titleMarkup = visibleTitle
    ? `
      <header class="action-sheet-header">
        <h2 id="${escapeAttribute(titleId)}">${escapeHtml(title)}</h2>
        <button class="action-sheet-close" type="button" data-action="${escapeAttribute(dismissAction)}" aria-label="Cerrar">
          ${renderIcon('close')}
        </button>
      </header>
    `
    : `<h2 class="visually-hidden" id="${escapeAttribute(titleId)}">${escapeHtml(title)}</h2>`;

  return `
    <div class="action-sheet-backdrop" role="presentation" data-action="${escapeAttribute(dismissAction)}"></div>
    <section
      class="${escapeAttribute(sheetClass)}"
      role="dialog"
      aria-modal="true"
      aria-labelledby="${escapeAttribute(titleId)}"
      data-dismiss-action="${escapeAttribute(dismissAction)}"
    >
      <div class="action-sheet-handle" aria-hidden="true"></div>
      ${titleMarkup}
      ${
        form
          ? `<form${formAttributes ? ` ${formAttributes}` : ''}>${content}</form>`
          : content
      }
    </section>
  `;
}

/**
 * Renderiza una fila de accion para una hoja modal inferior.
 *
 * @param {{
 *   label: string,
 *   icon: string,
 *   type?: string,
 *   action?: string,
 *   variant?: string,
 *   data?: Record<string, string>,
 *   separated?: boolean
 * }} action Accion a renderizar.
 * @returns {string} HTML de la fila.
 */
function renderActionSheetAction(action) {
  const type = action.type ?? 'button';
  const variant = action.variant ? ` is-${action.variant}` : '';
  const dataAction = action.action ? ` data-action="${escapeAttribute(action.action)}"` : '';
  const dataAttributes = renderActionSheetDataAttributes(action.data ?? {});
  const separator = action.separated ? '<div class="action-sheet-divider" aria-hidden="true"></div>' : '';

  return `
    ${separator}
    <button class="action-sheet-action${variant}" type="${escapeAttribute(type)}"${dataAction}${dataAttributes}>
      <span class="action-sheet-icon">${renderIcon(action.icon)}</span>
      <span>${escapeHtml(action.label)}</span>
    </button>
  `;
}

/**
 * Renderiza atributos seguros del formulario de una hoja de acciones.
 *
 * @param {{ className?: string, dataForm?: string }} form Configuracion del formulario.
 * @returns {string} Atributos HTML.
 */
function renderActionSheetFormAttributes(form) {
  const attributes = [];

  if (form.className) {
    attributes.push(`class="${escapeAttribute(form.className)}"`);
  }

  if (form.dataForm) {
    attributes.push(`data-form="${escapeAttribute(form.dataForm)}"`);
  }

  return attributes.join(' ');
}

/**
 * Renderiza campos ocultos seguros para formularios de hojas de acciones.
 *
 * @param {Array<{ name: string, value: string }>} hiddenInputs Campos ocultos.
 * @returns {string} Inputs ocultos.
 */
function renderActionSheetHiddenInputs(hiddenInputs) {
  return hiddenInputs.map((input) => `
    <input type="hidden" name="${escapeAttribute(input.name)}" value="${escapeAttribute(input.value)}" />
  `).join('');
}

/**
 * Renderiza atributos data-* de una accion.
 *
 * @param {Record<string, string>} data Datos de la accion.
 * @returns {string} Atributos data-*.
 */
function renderActionSheetDataAttributes(data) {
  return Object.entries(data)
    .map(([name, value]) => ` data-${toKebabCase(name)}="${escapeAttribute(value)}"`)
    .join('');
}

/**
 * Convierte una clave camelCase sencilla a kebab-case.
 *
 * @param {string} value Clave a convertir.
 * @returns {string} Clave en kebab-case.
 */
function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

const UI_ICON_BASE_URL = `${import.meta.env.BASE_URL}ui-icons/`;
const ICON_FILES = Object.freeze({
  action: 'action.svg',
  add: 'add.svg',
  autoFill: 'auto_fill.svg',
  breakfast: 'breakfast.svg',
  calendar: 'calendar.svg',
  chevronDown: 'chevron_down.svg',
  chevronRight: 'chevron_right.svg',
  check: 'check.svg',
  close: 'close.svg',
  delete: 'delete.svg',
  dinner: 'dinner.svg',
  done: 'done.svg',
  edit: 'edit.svg',
  export: 'export.svg',
  import: 'import.svg',
  lunch: 'lunch.svg',
  minus: 'minus.svg',
  pantry: 'pantry.svg',
  noUtensils: 'no-utensils.svg',
  recipes: 'recipes.svg',
  save: 'save.svg',
  search: 'search.svg',
  settings: 'settings.svg',
  shoppingList: 'shopping_list.svg',
  skipped: 'skipped.svg',
  stockMinus: 'stock_minus.svg',
  stockPlus: 'stock_plus.svg',
  utensils: 'utensils.svg',
  warning: 'warning.svg',
  weeklyPlan: 'weekly_plan.svg',
});

/**
 * Renderiza iconos SVG publicos conservando el color del contexto.
 *
 * @param {string} name Nombre del icono.
 * @returns {string} Marcado del icono.
 */
function renderIcon(name) {
  const iconFile = ICON_FILES[name] ?? ICON_FILES.calendar;
  const iconUrl = `${UI_ICON_BASE_URL}${iconFile}`;

  return `<span class="ui-icon" style="--ui-icon-url: url('${escapeAttribute(iconUrl)}')" aria-hidden="true"></span>`;
}
