import { DomainError } from '../../domain/errors.js';
import {
  createId,
  normalizeName,
  roundQuantity,
} from '../../domain/planning.js';
import {
  applyRecipeIngredientUpdates,
  cleanText,
  normalizeRecipeIngredientUpdates,
  parseNonNegativeQuantity,
  parsePositiveQuantity,
} from './helpers.js';

/**
 * Operaciones de despensa y stock.
 */
export const pantryServiceMethods = {
  /**
   * Crea un alimento de despensa validando duplicados por nombre.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre.
   * @param {number} params.quantity Cantidad inicial.
   * @param {string} params.unit Unidad.
   * @returns {Promise<import('../../domain/types.js').PantryItem>} Alimento creado.
   */
  async createPantryItem({ name, quantity, unit }) {
    const pantryItems = await this.database.getAll('pantryItems');
    const cleanName = cleanText(name);
    const cleanUnit = cleanText(unit);
    const parsedQuantity = parseNonNegativeQuantity(quantity, 'La cantidad del alimento no es valida.');

    if (!cleanName) {
      throw new DomainError('El alimento necesita un nombre.', 'PANTRY_NAME_REQUIRED');
    }

    if (!cleanUnit) {
      throw new DomainError('El alimento necesita una unidad.', 'PANTRY_UNIT_REQUIRED');
    }

    if (pantryItems.some((item) => normalizeName(item.name) === normalizeName(cleanName))) {
      throw new DomainError('Ya existe un alimento con ese nombre.', 'PANTRY_DUPLICATED');
    }

    const now = this.now().toISOString();
    const item = {
      id: createId('item'),
      name: cleanName,
      quantity: parsedQuantity,
      unit: cleanUnit,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('pantryItems', item);
  },

  /**
   * Actualiza un alimento existente conservando su identificador.
   *
   * Cambiar la unidad exige actualizar las cantidades de receta que usan este
   * alimento, porque esas cantidades se interpretan en la unidad del alimento.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre.
   * @param {number} params.quantity Cantidad disponible.
   * @param {string} params.unit Unidad.
   * @param {Array<{recipeId: string, quantity: number}>} [params.recipeIngredientUpdates]
   * Cantidades por racion para recetas que usan este alimento.
   * @returns {Promise<import('../../domain/types.js').PantryItem>} Alimento actualizado.
   */
  async updatePantryItem(pantryItemId, { name, quantity, unit, recipeIngredientUpdates = [] }) {
    const [pantryItems, recipes] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
    ]);
    const pantryItem = pantryItems.find((item) => item.id === pantryItemId);
    const cleanName = cleanText(name);
    const cleanUnit = cleanText(unit);
    const parsedQuantity = parseNonNegativeQuantity(quantity, 'La cantidad del alimento no es valida.');

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    if (!cleanName) {
      throw new DomainError('El alimento necesita un nombre.', 'PANTRY_NAME_REQUIRED');
    }

    if (!cleanUnit) {
      throw new DomainError('El alimento necesita una unidad.', 'PANTRY_UNIT_REQUIRED');
    }

    const duplicatedItem = pantryItems.find(
      (item) => item.id !== pantryItemId && normalizeName(item.name) === normalizeName(cleanName),
    );

    if (duplicatedItem) {
      throw new DomainError('Ya existe un alimento con ese nombre.', 'PANTRY_DUPLICATED');
    }

    const affectedRecipes = recipes.filter((recipe) =>
      recipe.ingredients.some((ingredient) => ingredient.pantryItemId === pantryItemId),
    );
    const normalizedRecipeIngredientUpdates = normalizeRecipeIngredientUpdates({
      recipeIngredientUpdates,
      affectedRecipes,
      mustUpdateAll: pantryItem.unit !== cleanUnit,
    });
    const updatedRecipes = applyRecipeIngredientUpdates({
      affectedRecipes,
      recipeIngredientUpdates: normalizedRecipeIngredientUpdates,
      pantryItemId,
      updatedAt: this.now().toISOString(),
    });
    const updatedItem = {
      ...pantryItem,
      name: cleanName,
      quantity: parsedQuantity,
      unit: cleanUnit,
      updatedAt: this.now().toISOString(),
    };

    await this.database.bulkPut('recipes', updatedRecipes);
    await this.database.put('pantryItems', updatedItem);
    await this.clearGeneratedShoppingItemsForPantryItems([pantryItemId]);

    return updatedItem;
  },

  /**
   * Suma cantidad a un alimento existente manteniendo su unidad.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @param {number} quantityToAdd Cantidad positiva que se añadira al stock.
   * @returns {Promise<import('../../domain/types.js').PantryItem>} Alimento actualizado.
   */
  async addPantryItemQuantity(pantryItemId, quantityToAdd) {
    const pantryItem = await this.database.get('pantryItems', pantryItemId);

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    const parsedQuantity = parsePositiveQuantity(
      quantityToAdd,
      'La cantidad a añadir debe ser mayor que cero.',
    );
    const updatedItem = {
      ...pantryItem,
      quantity: roundQuantity(pantryItem.quantity + parsedQuantity),
      updatedAt: this.now().toISOString(),
    };

    await this.database.put('pantryItems', updatedItem);
    await this.clearGeneratedShoppingItemsForPantryItems([pantryItemId]);

    return updatedItem;
  },

  /**
   * Resta cantidad de un alimento existente sin permitir stock negativo.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @param {number} quantityToSubtract Cantidad positiva que se descontara del stock.
   * @returns {Promise<import('../../domain/types.js').PantryItem>} Alimento actualizado.
   */
  async subtractPantryItemQuantity(pantryItemId, quantityToSubtract) {
    const pantryItem = await this.database.get('pantryItems', pantryItemId);

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    const parsedQuantity = parsePositiveQuantity(
      quantityToSubtract,
      'La cantidad a restar debe ser mayor que cero.',
    );
    const updatedItem = {
      ...pantryItem,
      quantity: roundQuantity(Math.max(0, pantryItem.quantity - parsedQuantity)),
      updatedAt: this.now().toISOString(),
    };

    await this.database.put('pantryItems', updatedItem);
    await this.clearGeneratedShoppingItemsForPantryItems([pantryItemId]);

    return updatedItem;
  },

  /**
   * Elimina un alimento si no aparece como ingrediente de ninguna receta.
   *
   * @param {string} pantryItemId Identificador del alimento.
   * @returns {Promise<import('../../domain/types.js').PantryItem>} Alimento eliminado.
   */
  async deletePantryItem(pantryItemId) {
    const [pantryItem, recipes] = await Promise.all([
      this.database.get('pantryItems', pantryItemId),
      this.database.getAll('recipes'),
    ]);

    if (!pantryItem) {
      throw new DomainError('El alimento no existe.', 'PANTRY_NOT_FOUND');
    }

    const blockingRecipe = recipes.find((recipe) =>
      recipe.ingredients.some((ingredient) => ingredient.pantryItemId === pantryItemId),
    );

    if (blockingRecipe) {
      throw new DomainError(
        `No puedes borrar "${pantryItem.name}" porque se usa en "${blockingRecipe.name}".`,
        'PANTRY_IN_USE',
      );
    }

    await this.database.delete('pantryItems', pantryItemId);
    await this.database.deleteWhere(
      'shoppingItems',
      (shoppingItem) =>
        shoppingItem.kind === 'generated' && shoppingItem.pantryItemId === pantryItemId,
    );

    return pantryItem;
  },

  /**
   * Restaura un alimento eliminado desde una accion de deshacer.
   *
   * @param {import('../../domain/types.js').PantryItem} pantryItem Alimento a restaurar.
   * @returns {Promise<import('../../domain/types.js').PantryItem>} Alimento restaurado.
   */
  async restorePantryItem(pantryItem) {
    const pantryItems = await this.database.getAll('pantryItems');

    if (pantryItems.some((item) => item.id === pantryItem.id)) {
      throw new DomainError('No se puede deshacer porque el alimento ya existe.', 'PANTRY_RESTORE_DUPLICATED_ID');
    }

    if (pantryItems.some((item) => normalizeName(item.name) === normalizeName(pantryItem.name))) {
      throw new DomainError('No se puede deshacer porque ya existe un alimento con ese nombre.', 'PANTRY_RESTORE_DUPLICATED_NAME');
    }

    return this.database.put('pantryItems', {
      ...pantryItem,
      updatedAt: this.now().toISOString(),
    });
  },

  /**
   * Elimina todos los alimentos si ninguna receta depende de ellos.
   *
   * @returns {Promise<number>} Numero de alimentos eliminados.
   */
  async clearPantryItems() {
    const [pantryItems, recipes] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
    ]);
    const pantryItemIds = new Set(pantryItems.map((item) => item.id));
    const blockingRecipe = recipes.find((recipe) =>
      recipe.ingredients.some((ingredient) => pantryItemIds.has(ingredient.pantryItemId)),
    );

    if (blockingRecipe) {
      throw new DomainError(
        `No puedes vaciar la despensa porque "${blockingRecipe.name}" usa alimentos guardados.`,
        'PANTRY_IN_USE',
      );
    }

    const deletedCount = await this.database.deleteWhere('pantryItems', () => true);
    await this.database.deleteWhere('shoppingItems', (shoppingItem) => shoppingItem.kind === 'generated');

    return deletedCount;
  },

  /**
   * Descuenta ingredientes de la despensa para una receta.
   *
   * @param {string} recipeId Identificador de receta.
   * @param {number} servings Raciones cocinadas.
   * @returns {Promise<void>}
   */
  async consumeRecipeIngredients(recipeId, servings) {
    const [recipe, pantryItems] = await Promise.all([
      this.database.get('recipes', recipeId),
      this.database.getAll('pantryItems'),
    ]);

    if (!recipe) {
      throw new DomainError('La receta no existe.', 'RECIPE_NOT_FOUND');
    }

    const pantryById = new Map(pantryItems.map((item) => [item.id, item]));
    const now = this.now().toISOString();
    const updatedItems = recipe.ingredients.map((ingredient) => {
      const pantryItem = pantryById.get(ingredient.pantryItemId);

      if (!pantryItem) {
        throw new DomainError('La receta contiene un alimento que ya no existe.', 'PANTRY_NOT_FOUND');
      }

      return {
        ...pantryItem,
        quantity: roundQuantity(Math.max(0, pantryItem.quantity - ingredient.quantity * servings)),
        updatedAt: now,
      };
    });

    await this.database.bulkPut('pantryItems', updatedItems);
    await this.clearGeneratedShoppingItemsForPantryItems(
      recipe.ingredients.map((ingredient) => ingredient.pantryItemId),
    );
  },
};
