import { MEAL_TYPES } from './types.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Convierte una fecha a formato YYYY-MM-DD en horario local.
 *
 * @param {Date} date Fecha de entrada.
 * @returns {string} Fecha ISO corta.
 */
export function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Construye una fecha local desde una cadena YYYY-MM-DD evitando saltos UTC.
 *
 * @param {string} isoDate Fecha en formato YYYY-MM-DD.
 * @returns {Date} Fecha local al mediodia.
 */
export function fromISODate(isoDate) {
  return new Date(`${isoDate}T12:00:00`);
}

/**
 * Suma dias naturales a una fecha sin mutar la instancia original.
 *
 * @param {Date} date Fecha base.
 * @param {number} days Dias a sumar.
 * @returns {Date} Nueva fecha.
 */
export function addDays(date, days) {
  const nextDate = new Date(date.getTime());
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

/**
 * Devuelve los siete dias siguientes empezando manana.
 *
 * @param {Date} [referenceDate=new Date()] Fecha usada como "hoy".
 * @returns {string[]} Fechas YYYY-MM-DD.
 */
export function getNextSevenDates(referenceDate = new Date()) {
  return Array.from({ length: 7 }, (_, index) => toISODate(addDays(referenceDate, index + 1)));
}

/**
 * Normaliza nombres para comparar duplicados de forma tolerante.
 *
 * @param {string} value Texto introducido por usuario.
 * @returns {string} Texto sin espacios sobrantes y en minusculas.
 */
export function normalizeName(value) {
  return String(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

/**
 * Crea un id suficientemente estable para datos locales del navegador.
 *
 * @param {string} [prefix='id'] Prefijo legible para depuracion.
 * @returns {string} Identificador unico.
 */
export function createId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Redondea cantidades para mostrarlas y almacenarlas sin ruido de coma flotante.
 *
 * @param {number} value Cantidad.
 * @returns {number} Cantidad redondeada a dos decimales.
 */
export function roundQuantity(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula una lista de la compra agregada para las comidas planificadas.
 *
 * @param {Object} params Parametros de calculo.
 * @param {import('./types.js').PantryItem[]} params.pantryItems Alimentos actuales.
 * @param {import('./types.js').Recipe[]} params.recipes Recetas disponibles.
 * @param {import('./types.js').PlannedMeal[]} params.plannedMeals Comidas a evaluar.
 * @returns {import('./types.js').ShoppingListItem[]} Compra necesaria.
 */
export function calculateShoppingList({ pantryItems, recipes, plannedMeals }) {
  const pantryById = new Map(pantryItems.map((item) => [item.id, item]));
  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const requiredByItem = new Map();

  for (const meal of plannedMeals) {
    const recipe = recipesById.get(meal.recipeId);
    if (!recipe) {
      continue;
    }

    for (const ingredient of recipe.ingredients) {
      const requiredQuantity = ingredient.quantity * meal.servings;
      requiredByItem.set(
        ingredient.pantryItemId,
        roundQuantity((requiredByItem.get(ingredient.pantryItemId) ?? 0) + requiredQuantity),
      );
    }
  }

  return [...requiredByItem.entries()]
    .map(([pantryItemId, requiredQuantity]) => {
      const pantryItem = pantryById.get(pantryItemId);
      const availableQuantity = pantryItem?.quantity ?? 0;
      const missingQuantity = roundQuantity(requiredQuantity - availableQuantity);

      if (!pantryItem || missingQuantity <= 0) {
        return null;
      }

      return {
        pantryItemId,
        name: pantryItem.name,
        missingQuantity,
        unit: pantryItem.unit,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

/**
 * Genera una planificacion aleatoria para los siete dias siguientes.
 *
 * @param {Object} params Parametros de generacion.
 * @param {import('./types.js').Recipe[]} params.recipes Recetas candidatas.
 * @param {Date} [params.referenceDate=new Date()] Fecha que se considera hoy.
 * @param {number} [params.servings=1] Raciones por comida.
 * @param {() => number} [params.random=Math.random] Fuente de aleatoriedad.
 * @returns {{ plannedMeals: import('./types.js').PlannedMeal[], missingSlots: Array<{date: string, mealType: import('./types.js').MealType}> }}
 * Plan generado y huecos sin receta compatible.
 */
export function buildRandomWeekPlan({
  recipes,
  referenceDate = new Date(),
  servings = 1,
  random = Math.random,
}) {
  const dates = getNextSevenDates(referenceDate);
  const plannedMeals = [];
  const missingSlots = [];

  for (const date of dates) {
    for (const mealType of MEAL_TYPES) {
      const candidates = recipes.filter((recipe) => recipe.mealTypes.includes(mealType));

      if (candidates.length === 0) {
        missingSlots.push({ date, mealType });
        continue;
      }

      const selectedRecipe = candidates[Math.floor(random() * candidates.length)];
      const now = new Date().toISOString();
      plannedMeals.push({
        id: createId('meal'),
        date,
        mealType,
        recipeId: selectedRecipe.id,
        servings,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return { plannedMeals, missingSlots };
}

/**
 * Ordena comidas por fecha y por orden natural del dia.
 *
 * @param {import('./types.js').PlannedMeal[]} plannedMeals Comidas a ordenar.
 * @returns {import('./types.js').PlannedMeal[]} Nueva lista ordenada.
 */
export function sortPlannedMeals(plannedMeals) {
  const mealOrder = new Map(MEAL_TYPES.map((mealType, index) => [mealType, index]));

  return [...plannedMeals].sort((left, right) => {
    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return mealOrder.get(left.mealType) - mealOrder.get(right.mealType);
  });
}
