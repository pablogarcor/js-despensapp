import { DomainError } from '../errors.js';
import { PLAN_NOTE_TITLES, PLANNED_MEAL_KINDS } from '../types.js';
import {
  assertArray,
  assertUniqueIds,
  isPlainObject,
  parseDate,
  parseMealType,
  parseOptionalString,
  parseOptionalText,
  parsePositiveNumber,
  parseRequiredString,
} from './parsers.js';

/**
 * Valida comidas planificadas y su relacion con recetas.
 *
 * @param {unknown} records Registros de entrada.
 * @param {import('../types.js').Recipe[]} recipes Recetas validadas.
 * @param {number} schemaVersion Version del backup.
 * @returns {import('../types.js').PlannedMeal[]} Comidas saneadas.
 */
export function validatePlannedMeals(records, recipes, schemaVersion) {
  assertArray(records, 'El backup debe incluir una lista de comidas planificadas.');
  assertUniqueIds(records, 'Hay comidas planificadas duplicadas en el backup.');

  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const occupiedSlots = new Set();

  return records.map((record) => {
    if (!isPlainObject(record)) {
      throw new DomainError('Hay una comida planificada con formato invalido.', 'BACKUP_MEAL_INVALID');
    }

    const id = parseRequiredString(record.id, 'Hay una comida planificada sin identificador.');
    const date = parseDate(record.date);
    const mealType = parseMealType(record.mealType);
    const kind =
      schemaVersion >= 3
        ? parsePlannedMealKind(record.kind ?? 'recipe')
        : 'recipe';

    const slotKey = `${date}__${mealType}`;

    if (occupiedSlots.has(slotKey)) {
      throw new DomainError('Hay dos comidas planificadas en la misma fecha y franja.', 'BACKUP_MEAL_DUPLICATED');
    }

    occupiedSlots.add(slotKey);

    if (kind === 'note') {
      return validatePlannedNoteRecord({ record, id, date, mealType, kind });
    }

    const recipeId = parseRequiredString(record.recipeId, 'Hay una comida planificada sin receta.');
    const servings = parsePositiveNumber(record.servings, 'Hay una comida planificada con raciones invalidas.');
    const recipe = recipesById.get(recipeId);

    if (!recipe) {
      throw new DomainError('Hay una comida planificada con una receta inexistente.', 'BACKUP_MEAL_RECIPE');
    }

    if (!recipe.mealTypes.includes(mealType)) {
      throw new DomainError('Hay una comida planificada con una receta incompatible.', 'BACKUP_MEAL_COMPATIBILITY');
    }

    return {
      id,
      kind: 'recipe',
      date,
      mealType,
      recipeId,
      servings,
      createdAt: parseOptionalString(record.createdAt),
      updatedAt: parseOptionalString(record.updatedAt),
    };
  });
}

/**
 * Valida una comida planificada sin receta.
 *
 * @param {Object} params Parametros.
 * @param {Record<string, unknown>} params.record Registro original.
 * @param {string} params.id Identificador.
 * @param {string} params.date Fecha.
 * @param {import('../types.js').MealType} params.mealType Franja.
 * @param {import('../types.js').PlannedMealKind} params.kind Tipo.
 * @returns {import('../types.js').PlannedMeal} Nota validada.
 */
function validatePlannedNoteRecord({ record, id, date, mealType, kind }) {
  const title = parsePlanNoteTitle(record.title);
  const note = parseOptionalText(record.note);

  if (title === 'Otro motivo' && !note) {
    throw new DomainError('Hay una planificacion sin cocina sin detalle.', 'BACKUP_MEAL_NOTE_REQUIRED');
  }

  return {
    id,
    kind,
    date,
    mealType,
    title,
    note,
    createdAt: parseOptionalString(record.createdAt),
    updatedAt: parseOptionalString(record.updatedAt),
  };
}

/**
 * Valida el tipo de una comida planificada.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {import('../types.js').PlannedMealKind} Tipo valido.
 */
function parsePlannedMealKind(value) {
  if (!PLANNED_MEAL_KINDS.includes(value)) {
    throw new DomainError('Hay un tipo de planificacion invalido en el backup.', 'BACKUP_MEAL_KIND');
  }

  return value;
}

/**
 * Valida un titulo de nota de plan.
 *
 * @param {unknown} value Valor de entrada.
 * @returns {string} Titulo saneado.
 */
function parsePlanNoteTitle(value) {
  const title = parseRequiredString(value, 'Hay una planificacion sin cocina sin motivo.');
  const normalizedTitle = title === 'Nota libre' ? 'Otro motivo' : title;

  if (!PLAN_NOTE_TITLES.includes(normalizedTitle)) {
    throw new DomainError('Hay una planificacion sin cocina con motivo invalido.', 'BACKUP_MEAL_NOTE_TITLE');
  }

  return normalizedTitle;
}
