import { DomainError } from '../../domain/errors.js';
import { PLAN_NOTE_TITLES } from '../../domain/types.js';
import { cleanText } from './text.js';

/**
 * Normaliza comidas antiguas que no tienen `kind`.
 *
 * @param {import('../../domain/types.js').PlannedMeal[]} plannedMeals Comidas guardadas.
 * @returns {import('../../domain/types.js').PlannedMeal[]} Comidas normalizadas.
 */
export function normalizePlannedMeals(plannedMeals) {
  return plannedMeals.map((meal) => ({
    ...meal,
    kind: meal.kind ?? 'recipe',
    title: meal.kind === 'note' ? normalizePlanNoteTitle(meal.title) : meal.title,
  }));
}

/**
 * Indica si una planificacion consume una receta.
 *
 * @param {import('../../domain/types.js').PlannedMeal} plannedMeal Planificacion.
 * @returns {boolean} True si es comida con receta.
 */
export function isRecipePlannedMeal(plannedMeal) {
  return (plannedMeal.kind ?? 'recipe') === 'recipe';
}

/**
 * Indica si una planificacion es una nota sin receta.
 *
 * @param {import('../../domain/types.js').PlannedMeal} plannedMeal Planificacion.
 * @returns {boolean} True si es nota.
 */
export function isNotePlannedMeal(plannedMeal) {
  return plannedMeal.kind === 'note';
}

/**
 * Valida y sanea una nota de plan.
 *
 * @param {Object} params Datos de entrada.
 * @param {string} params.title Titulo.
 * @param {string} params.note Detalle opcional.
 * @returns {{title: string, note: string}} Nota saneada.
 */
export function normalizePlanNoteInput({ title, note }) {
  const cleanTitle = normalizePlanNoteTitle(cleanText(title));
  const cleanNote = cleanText(note);

  if (!PLAN_NOTE_TITLES.includes(cleanTitle)) {
    throw new DomainError('Selecciona un motivo valido para no cocinar.', 'PLAN_NOTE_TITLE_INVALID');
  }

  if (cleanTitle === 'Otro motivo' && !cleanNote) {
    throw new DomainError('Escribe el motivo para no cocinar.', 'PLAN_NOTE_REQUIRED');
  }

  return {
    title: cleanTitle,
    note: cleanNote,
  };
}

/**
 * Normaliza titulos antiguos de notas de plan.
 *
 * @param {string} title Titulo guardado o introducido.
 * @returns {string} Titulo actual.
 */
export function normalizePlanNoteTitle(title) {
  return title === 'Nota libre' ? 'Otro motivo' : title;
}
