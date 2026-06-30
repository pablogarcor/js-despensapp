import { escapeAttribute } from '../renderUtils.js';

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
  noUtensils: 'no-utensils.svg',
  pantry: 'pantry.svg',
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
 * Metodos compartidos para renderizar iconos.
 */
export const iconRenderMethods = {
  renderIcon(name) {
    return renderIcon(name);
  },
};

/**
 * Renderiza iconos SVG publicos conservando el color del contexto.
 *
 * @param {string} name Nombre del icono.
 * @returns {string} Marcado del icono.
 */
export function renderIcon(name) {
  const iconFile = ICON_FILES[name] ?? ICON_FILES.calendar;
  const iconUrl = `${UI_ICON_BASE_URL}${iconFile}`;

  return `<span class="ui-icon" style="--ui-icon-url: url('${escapeAttribute(iconUrl)}')" aria-hidden="true"></span>`;
}
