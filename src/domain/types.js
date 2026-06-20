/**
 * @typedef {'breakfast' | 'lunch' | 'dinner'} MealType
 * Tipo de comida soportado por la planificacion del MVP.
 */

/**
 * @typedef {Object} PantryItem
 * @property {string} id Identificador estable del alimento.
 * @property {string} name Nombre visible del alimento.
 * @property {number} quantity Cantidad disponible en la despensa.
 * @property {string} unit Unidad en la que se mide el alimento.
 * @property {string} createdAt Fecha ISO de creacion.
 * @property {string} updatedAt Fecha ISO de ultima modificacion.
 */

/**
 * @typedef {Object} RecipeIngredient
 * @property {string} pantryItemId Identificador del alimento requerido.
 * @property {number} quantity Cantidad necesaria por racion.
 */

/**
 * @typedef {Object} Recipe
 * @property {string} id Identificador estable de la receta.
 * @property {string} name Nombre visible de la receta.
 * @property {MealType[]} mealTypes Momentos del dia para los que encaja.
 * @property {RecipeIngredient[]} ingredients Ingredientes necesarios por racion.
 * @property {string} createdAt Fecha ISO de creacion.
 * @property {string} updatedAt Fecha ISO de ultima modificacion.
 */

/**
 * @typedef {Object} PlannedMeal
 * @property {string} id Identificador estable de la comida planificada.
 * @property {string} date Fecha en formato YYYY-MM-DD.
 * @property {MealType} mealType Momento del dia.
 * @property {string} recipeId Identificador de la receta planificada.
 * @property {number} servings Numero de raciones que se prepararan.
 * @property {string} createdAt Fecha ISO de creacion.
 * @property {string} updatedAt Fecha ISO de ultima modificacion.
 */

/**
 * @typedef {Object} MealSlot
 * @property {string} date Fecha en formato YYYY-MM-DD.
 * @property {MealType} mealType Momento del dia.
 */

/**
 * @typedef {Object} ShoppingListItem
 * @property {string} pantryItemId Identificador del alimento que falta.
 * @property {string} name Nombre visible del alimento.
 * @property {number} missingQuantity Cantidad adicional necesaria.
 * @property {string} unit Unidad del alimento.
 */

/**
 * @typedef {Object} DashboardSnapshot
 * @property {PantryItem[]} pantryItems Alimentos ordenados por nombre.
 * @property {Recipe[]} recipes Recetas ordenadas por nombre.
 * @property {PlannedMeal[]} plannedMeals Comidas futuras o de hoy.
 * @property {PlannedMeal[]} pendingMeals Comidas pasadas pendientes de confirmar.
 * @property {MealSlot[]} missingPlanSlots Huecos de los proximos siete dias sin comida.
 * @property {ShoppingListItem[]} shoppingList Compra necesaria para el plan activo.
 */

export const MEAL_TYPES = Object.freeze(['breakfast', 'lunch', 'dinner']);

export const MEAL_TYPE_LABELS = Object.freeze({
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
});

export const DEFAULT_UNITS = Object.freeze(['g', 'kg', 'ml', 'l', 'ud', 'rebanadas']);
