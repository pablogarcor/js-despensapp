import { DomainError } from '../../domain/errors.js';
import {
  buildRandomMealsForSlots,
  buildRandomWeekPlan,
  createId,
  findMissingMealSlots,
  getNextSevenDates,
  toISODate,
} from '../../domain/planning.js';
import { MEAL_TYPES } from '../../domain/types.js';
import {
  cleanText,
  isNotePlannedMeal,
  isRecipePlannedMeal,
  normalizePlanNoteInput,
  parsePositiveQuantity,
} from './helpers.js';

/**
 * Operaciones de planificacion semanal y comidas.
 */
export const plannedMealServiceMethods = {
  /**
   * Genera una nueva planificacion para los siete dias siguientes.
   *
   * Borra primero las comidas de hoy en adelante para que la tabla no acumule
   * semanas antiguas. Las comidas pasadas se conservan hasta que el usuario las
   * confirme como hechas o no hechas.
   *
   * @param {Object} params Datos de entrada.
   * @param {number} params.servings Raciones por comida.
   * @returns {Promise<{plannedMeals: import('../../domain/types.js').PlannedMeal[], missingSlots: Array<{date: string, mealType: import('../../domain/types.js').MealType}>}>}
   * Resultado de la planificacion.
   */
  async planNextWeek({ servings }) {
    const parsedServings = parsePositiveQuantity(servings, 'Las raciones deben ser mayores que cero.');
    const recipes = await this.database.getAll('recipes');

    if (recipes.length === 0) {
      throw new DomainError('Necesitas al menos una receta para planificar.', 'NO_RECIPES');
    }

    await this.clearCurrentAndFutureMeals();

    const result = buildRandomWeekPlan({
      recipes,
      referenceDate: this.now(),
      servings: parsedServings,
      random: this.random,
    });

    await this.database.bulkPut('plannedMeals', result.plannedMeals);
    return result;
  },

  /**
   * Rellena aleatoriamente los huecos de los proximos siete dias sin borrar el plan actual.
   *
   * @param {Object} params Datos de entrada.
   * @param {number} params.servings Raciones para cada comida nueva.
   * @returns {Promise<{plannedMeals: import('../../domain/types.js').PlannedMeal[], missingSlots: import('../../domain/types.js').MealSlot[]}>}
   * Comidas creadas y huecos que no se pudieron completar por falta de receta compatible.
   */
  async completeWeekPlan({ servings }) {
    const parsedServings = parsePositiveQuantity(servings, 'Las raciones deben ser mayores que cero.');
    const [recipes, allMeals] = await Promise.all([
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
    ]);

    if (recipes.length === 0) {
      throw new DomainError('Necesitas al menos una receta para completar el plan.', 'NO_RECIPES');
    }

    const today = toISODate(this.now());
    const plannedMeals = allMeals.filter((meal) => meal.date >= today);
    const slots = findMissingMealSlots({
      plannedMeals,
      referenceDate: this.now(),
    });

    if (slots.length === 0) {
      return { plannedMeals: [], missingSlots: [] };
    }

    const result = buildRandomMealsForSlots({
      recipes,
      slots,
      servings: parsedServings,
      random: this.random,
    });

    await this.database.bulkPut('plannedMeals', result.plannedMeals);
    return result;
  },

  /**
   * Anade una comida manual a un hueco libre de la semana planificada.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.date Fecha YYYY-MM-DD.
   * @param {import('../../domain/types.js').MealType} params.mealType Franja del dia.
   * @param {string} params.recipeId Receta seleccionada.
   * @param {number} params.servings Raciones.
   * @returns {Promise<import('../../domain/types.js').PlannedMeal>} Comida creada.
   */
  async createPlannedMeal({ date, mealType, recipeId, servings }) {
    const cleanDate = cleanText(date);
    const cleanMealType = cleanText(mealType);
    const cleanRecipeId = cleanText(recipeId);
    const parsedServings = parsePositiveQuantity(servings, 'Las raciones deben ser mayores que cero.');
    const allowedDates = getNextSevenDates(this.now());

    if (!allowedDates.includes(cleanDate)) {
      throw new DomainError('Solo puedes añadir comidas dentro de los proximos siete dias.', 'DATE_OUT_OF_PLAN');
    }

    if (!MEAL_TYPES.includes(cleanMealType)) {
      throw new DomainError('La franja de comida no es valida.', 'MEAL_TYPE_INVALID');
    }

    const [recipe, plannedMeals] = await Promise.all([
      this.database.get('recipes', cleanRecipeId),
      this.database.getAll('plannedMeals'),
    ]);

    if (!recipe) {
      throw new DomainError('La receta no existe.', 'RECIPE_NOT_FOUND');
    }

    if (!recipe.mealTypes.includes(cleanMealType)) {
      throw new DomainError('La receta no esta indicada para esa franja.', 'RECIPE_NOT_COMPATIBLE');
    }

    const occupiedMeal = plannedMeals.find(
      (meal) => meal.date === cleanDate && meal.mealType === cleanMealType,
    );

    if (occupiedMeal) {
      throw new DomainError('Ya existe una comida planificada para ese hueco.', 'PLANNED_MEAL_DUPLICATED');
    }

    const now = this.now().toISOString();
    const plannedMeal = {
      id: createId('meal'),
      kind: 'recipe',
      date: cleanDate,
      mealType: cleanMealType,
      recipeId: cleanRecipeId,
      servings: parsedServings,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('plannedMeals', plannedMeal);
  },

  /**
   * Anade una entrada de No cocinar a un hueco libre de la semana planificada.
   *
   * Estas entradas ocupan franja y fecha, pero no tienen receta, raciones ni compra asociada.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.date Fecha YYYY-MM-DD.
   * @param {import('../../domain/types.js').MealType} params.mealType Franja del dia.
   * @param {string} params.title Motivo predefinido.
   * @param {string} [params.note] Detalle libre opcional.
   * @returns {Promise<import('../../domain/types.js').PlannedMeal>} Entrada creada.
   */
  async createPlannedNote({ date, mealType, title, note = '' }) {
    const cleanDate = cleanText(date);
    const cleanMealType = cleanText(mealType);
    const { title: cleanTitle, note: cleanNote } = normalizePlanNoteInput({ title, note });
    const allowedDates = getNextSevenDates(this.now());

    if (!allowedDates.includes(cleanDate)) {
      throw new DomainError('Solo puedes marcar no cocinar dentro de los proximos siete dias.', 'DATE_OUT_OF_PLAN');
    }

    if (!MEAL_TYPES.includes(cleanMealType)) {
      throw new DomainError('La franja de comida no es valida.', 'MEAL_TYPE_INVALID');
    }

    const plannedMeals = await this.database.getAll('plannedMeals');
    const occupiedMeal = plannedMeals.find(
      (meal) => meal.date === cleanDate && meal.mealType === cleanMealType,
    );

    if (occupiedMeal) {
      throw new DomainError('Ya existe una comida planificada para ese hueco.', 'PLANNED_MEAL_DUPLICATED');
    }

    const now = this.now().toISOString();
    const plannedNote = {
      id: createId('meal'),
      kind: 'note',
      date: cleanDate,
      mealType: cleanMealType,
      title: cleanTitle,
      note: cleanNote,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('plannedMeals', plannedNote);
  },

  /**
   * Actualiza una comida planificada existente.
   *
   * @param {string} plannedMealId Identificador de la comida.
   * @param {Object} params Datos de entrada.
   * @param {string} params.recipeId Receta seleccionada.
   * @param {number} params.servings Raciones.
   * @returns {Promise<import('../../domain/types.js').PlannedMeal>} Comida actualizada.
   */
  async updatePlannedMeal(plannedMealId, { recipeId, servings }) {
    const cleanRecipeId = cleanText(recipeId);
    const parsedServings = parsePositiveQuantity(servings, 'Las raciones deben ser mayores que cero.');

    const [plannedMeal, recipe] = await Promise.all([
      this.database.get('plannedMeals', plannedMealId),
      this.database.get('recipes', cleanRecipeId),
    ]);

    if (!plannedMeal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    if (!isRecipePlannedMeal(plannedMeal)) {
      throw new DomainError('Esta planificacion es de no cocinar, no una receta.', 'PLANNED_MEAL_KIND_INVALID');
    }

    if (!recipe) {
      throw new DomainError('La receta no existe.', 'RECIPE_NOT_FOUND');
    }

    if (!recipe.mealTypes.includes(plannedMeal.mealType)) {
      throw new DomainError('La receta no esta indicada para esa franja.', 'RECIPE_NOT_COMPATIBLE');
    }

    const updatedMeal = {
      ...plannedMeal,
      recipeId: cleanRecipeId,
      servings: parsedServings,
      updatedAt: this.now().toISOString(),
    };

    return this.database.put('plannedMeals', updatedMeal);
  },

  /**
   * Convierte una comida planificada con receta en una entrada de No cocinar.
   *
   * Conserva identificador, fecha y franja para mantener estable la planificacion.
   *
   * @param {string} plannedMealId Identificador de la comida.
   * @param {Object} params Datos de entrada.
   * @param {string} params.title Motivo predefinido.
   * @param {string} [params.note] Detalle libre opcional.
   * @returns {Promise<import('../../domain/types.js').PlannedMeal>} Entrada convertida.
   */
  async convertPlannedMealToNote(plannedMealId, { title, note = '' }) {
    const plannedMeal = await this.database.get('plannedMeals', plannedMealId);

    if (!plannedMeal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    if (!isRecipePlannedMeal(plannedMeal)) {
      throw new DomainError('Esta planificacion ya es de no cocinar.', 'PLANNED_MEAL_KIND_INVALID');
    }

    const { title: cleanTitle, note: cleanNote } = normalizePlanNoteInput({ title, note });
    const updatedMeal = {
      id: plannedMeal.id,
      kind: 'note',
      date: plannedMeal.date,
      mealType: plannedMeal.mealType,
      title: cleanTitle,
      note: cleanNote,
      createdAt: plannedMeal.createdAt,
      updatedAt: this.now().toISOString(),
    };

    return this.database.put('plannedMeals', updatedMeal);
  },

  /**
   * Actualiza una entrada de No cocinar conservando fecha y franja.
   *
   * @param {string} plannedMealId Identificador de la entrada.
   * @param {Object} params Datos de entrada.
   * @param {string} params.title Titulo predefinido.
   * @param {string} [params.note] Detalle libre opcional.
   * @returns {Promise<import('../../domain/types.js').PlannedMeal>} Entrada actualizada.
   */
  async updatePlannedNote(plannedMealId, { title, note = '' }) {
    const plannedMeal = await this.database.get('plannedMeals', plannedMealId);
    const { title: cleanTitle, note: cleanNote } = normalizePlanNoteInput({ title, note });

    if (!plannedMeal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    if (!isNotePlannedMeal(plannedMeal)) {
      throw new DomainError('Esta planificacion no es de no cocinar.', 'PLANNED_MEAL_KIND_INVALID');
    }

    const updatedMeal = {
      ...plannedMeal,
      kind: 'note',
      title: cleanTitle,
      note: cleanNote,
      updatedAt: this.now().toISOString(),
    };

    return this.database.put('plannedMeals', updatedMeal);
  },

  /**
   * Elimina una comida planificada.
   *
   * @param {string} plannedMealId Identificador de la comida.
   * @returns {Promise<void>}
   */
  async deletePlannedMeal(plannedMealId) {
    const plannedMeal = await this.database.get('plannedMeals', plannedMealId);

    if (!plannedMeal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    await this.database.delete('plannedMeals', plannedMealId);
  },

  /**
   * Borra todas las comidas desde hoy en adelante.
   *
   * @returns {Promise<number>} Numero de comidas eliminadas.
   */
  async clearCurrentAndFutureMeals() {
    const today = toISODate(this.now());
    const deletedCount = await this.database.deleteWhere('plannedMeals', (meal) => meal.date >= today);
    await this.database.deleteWhere('shoppingItems', (shoppingItem) => shoppingItem.kind === 'generated');

    return deletedCount;
  },

  /**
   * Resuelve una comida pasada y, si se hizo, descuenta ingredientes.
   *
   * @param {string} plannedMealId Identificador de la comida.
   * @param {boolean} wasCooked Indica si finalmente se preparo.
   * @returns {Promise<void>}
   */
  async resolvePastMeal(plannedMealId, wasCooked) {
    const meal = await this.database.get('plannedMeals', plannedMealId);

    if (!meal) {
      throw new DomainError('La comida planificada no existe.', 'PLANNED_MEAL_NOT_FOUND');
    }

    if (wasCooked && isRecipePlannedMeal(meal)) {
      await this.consumeRecipeIngredients(meal.recipeId, meal.servings);
    }

    await this.database.delete('plannedMeals', plannedMealId);
  },
};
