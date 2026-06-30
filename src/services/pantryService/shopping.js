import { DomainError } from '../../domain/errors.js';
import {
  calculateShoppingList,
  createId,
  normalizeName,
  roundQuantity,
  toISODate,
} from '../../domain/planning.js';
import {
  cleanText,
  getPantryItemIdFromGeneratedShoppingId,
  isGeneratedShoppingItemId,
  parsePositiveQuantity,
} from './helpers.js';

/**
 * Operaciones de lista de compra y su impacto en despensa.
 */
export const shoppingServiceMethods = {
  /**
   * Crea un extra manual en la lista de compra.
   *
   * @param {Object} params Datos de entrada.
   * @param {string} params.name Nombre del alimento o producto.
   * @param {number} params.quantity Cantidad a comprar.
   * @param {string} params.unit Unidad.
   * @returns {Promise<import('../../domain/types.js').ShoppingItem>} Extra creado.
   */
  async createShoppingExtra({ name, quantity, unit }) {
    const cleanName = cleanText(name);
    const cleanUnit = cleanText(unit);
    const parsedQuantity = parsePositiveQuantity(quantity, 'La cantidad del extra debe ser mayor que cero.');

    if (!cleanName) {
      throw new DomainError('El extra necesita un nombre.', 'SHOPPING_EXTRA_NAME_REQUIRED');
    }

    if (!cleanUnit) {
      throw new DomainError('El extra necesita una unidad.', 'SHOPPING_EXTRA_UNIT_REQUIRED');
    }

    const now = this.now().toISOString();
    const shoppingItem = {
      id: createId('shopping'),
      kind: 'extra',
      name: cleanName,
      quantity: parsedQuantity,
      unit: cleanUnit,
      checked: false,
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('shoppingItems', shoppingItem);
  },

  /**
   * Marca o desmarca una entrada de la lista de compra.
   *
   * Las entradas generadas por el plan se crean bajo demanda para guardar solo
   * su estado, manteniendo cantidad y nombre calculados desde la planificacion.
   *
   * @param {string} shoppingItemId Identificador de compra.
   * @param {boolean} checked Estado marcado.
   * @returns {Promise<import('../../domain/types.js').ShoppingItem>} Entrada actualizada.
   */
  async setShoppingItemChecked(shoppingItemId, checked) {
    const cleanShoppingItemId = cleanText(shoppingItemId);
    const existingItem = await this.database.get('shoppingItems', cleanShoppingItemId);
    const now = this.now().toISOString();

    if (existingItem) {
      const updatedItem = {
        ...existingItem,
        checked: Boolean(checked),
        updatedAt: now,
      };

      return this.database.put('shoppingItems', updatedItem);
    }

    if (!isGeneratedShoppingItemId(cleanShoppingItemId)) {
      throw new DomainError('La entrada de compra no existe.', 'SHOPPING_ITEM_NOT_FOUND');
    }

    const pantryItemId = getPantryItemIdFromGeneratedShoppingId(cleanShoppingItemId);
    const pantryItem = await this.database.get('pantryItems', pantryItemId);

    if (!pantryItem) {
      throw new DomainError('El alimento de la compra no existe.', 'PANTRY_NOT_FOUND');
    }

    const shoppingItem = {
      id: cleanShoppingItemId,
      kind: 'generated',
      pantryItemId,
      checked: Boolean(checked),
      createdAt: now,
      updatedAt: now,
    };

    return this.database.put('shoppingItems', shoppingItem);
  },

  /**
   * Elimina un extra manual de la lista de compra.
   *
   * @param {string} shoppingItemId Identificador del extra.
   * @returns {Promise<void>}
   */
  async deleteShoppingExtra(shoppingItemId) {
    const shoppingItem = await this.database.get('shoppingItems', shoppingItemId);

    if (!shoppingItem || shoppingItem.kind !== 'extra') {
      throw new DomainError('El extra de compra no existe.', 'SHOPPING_EXTRA_NOT_FOUND');
    }

    await this.database.delete('shoppingItems', shoppingItemId);
  },

  /**
   * Suma a la despensa todas las entradas marcadas como compradas.
   *
   * Los faltantes generados incrementan su alimento existente. Los extras
   * incrementan un alimento existente con la misma unidad o crean uno nuevo.
   *
   * @returns {Promise<{purchasedItems: number, updatedPantryItems: number, createdPantryItems: number}>}
   * Resumen de compra aplicada.
   */
  async applyShoppingPurchase() {
    const [pantryItems, recipes, allMeals, shoppingItems] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
      this.database.getAll('shoppingItems'),
    ]);
    const checkedShoppingItems = shoppingItems.filter((item) => item.checked);

    if (checkedShoppingItems.length === 0) {
      throw new DomainError('Marca al menos un alimento comprado.', 'SHOPPING_PURCHASE_EMPTY');
    }

    const today = toISODate(this.now());
    const plannedMeals = allMeals.filter((meal) => meal.date >= today);
    const generatedShoppingItems = calculateShoppingList({ pantryItems, recipes, plannedMeals });
    const generatedByPantryItemId = new Map(
      generatedShoppingItems.map((item) => [item.pantryItemId, item]),
    );
    const nextPantryItemsById = new Map(pantryItems.map((item) => [item.id, item]));
    const pantryItemsByName = new Map(pantryItems.map((item) => [normalizeName(item.name), item]));
    const touchedPantryItemIds = new Set();
    const createdPantryItemIds = new Set();
    const now = this.now().toISOString();
    let purchasedItems = 0;

    const addQuantityToPantryItem = (pantryItem, quantity) => {
      const currentItem = nextPantryItemsById.get(pantryItem.id) ?? pantryItem;
      const updatedItem = {
        ...currentItem,
        quantity: roundQuantity(currentItem.quantity + quantity),
        updatedAt: now,
      };

      nextPantryItemsById.set(updatedItem.id, updatedItem);
      pantryItemsByName.set(normalizeName(updatedItem.name), updatedItem);
      touchedPantryItemIds.add(updatedItem.id);
    };

    for (const shoppingItem of checkedShoppingItems) {
      if (shoppingItem.kind !== 'generated') {
        continue;
      }

      const generatedItem = generatedByPantryItemId.get(shoppingItem.pantryItemId);
      const pantryItem = nextPantryItemsById.get(shoppingItem.pantryItemId);

      if (!generatedItem || !pantryItem) {
        continue;
      }

      addQuantityToPantryItem(pantryItem, generatedItem.missingQuantity);
      purchasedItems += 1;
    }

    for (const shoppingItem of checkedShoppingItems) {
      if (shoppingItem.kind !== 'extra') {
        continue;
      }

      const cleanName = cleanText(shoppingItem.name);
      const cleanUnit = cleanText(shoppingItem.unit);
      const parsedQuantity = parsePositiveQuantity(
        shoppingItem.quantity,
        'La cantidad del extra debe ser mayor que cero.',
      );
      const existingPantryItem = pantryItemsByName.get(normalizeName(cleanName));

      if (existingPantryItem) {
        if (existingPantryItem.unit !== cleanUnit) {
          throw new DomainError(
            `"${cleanName}" ya existe en ${existingPantryItem.unit}. Usa esa unidad o edita el alimento.`,
            'SHOPPING_EXTRA_UNIT_MISMATCH',
          );
        }

        addQuantityToPantryItem(existingPantryItem, parsedQuantity);
      } else {
        const newPantryItem = {
          id: createId('item'),
          name: cleanName,
          quantity: parsedQuantity,
          unit: cleanUnit,
          createdAt: now,
          updatedAt: now,
        };

        nextPantryItemsById.set(newPantryItem.id, newPantryItem);
        pantryItemsByName.set(normalizeName(newPantryItem.name), newPantryItem);
        createdPantryItemIds.add(newPantryItem.id);
      }

      purchasedItems += 1;
    }

    if (purchasedItems === 0) {
      throw new DomainError('No hay compra pendiente marcada.', 'SHOPPING_PURCHASE_EMPTY');
    }

    const checkedShoppingItemIds = new Set(checkedShoppingItems.map((item) => item.id));
    const remainingShoppingItems = shoppingItems.filter(
      (item) =>
        !checkedShoppingItemIds.has(item.id) &&
        !(item.kind === 'generated' && touchedPantryItemIds.has(item.pantryItemId)),
    );

    await this.database.replaceStores({
      pantryItems: [...nextPantryItemsById.values()],
      shoppingItems: remainingShoppingItems,
    });

    return {
      purchasedItems,
      updatedPantryItems: touchedPantryItemIds.size,
      createdPantryItems: createdPantryItemIds.size,
    };
  },

  /**
   * Limpia estados generados de compra cuando cambia el stock de alimentos.
   *
   * @param {string[]} pantryItemIds Identificadores afectados.
   * @returns {Promise<number>} Numero de entradas eliminadas.
   */
  async clearGeneratedShoppingItemsForPantryItems(pantryItemIds) {
    const affectedPantryItemIds = new Set(pantryItemIds);

    if (affectedPantryItemIds.size === 0) {
      return 0;
    }

    return this.database.deleteWhere(
      'shoppingItems',
      (shoppingItem) =>
        shoppingItem.kind === 'generated' &&
        affectedPantryItemIds.has(shoppingItem.pantryItemId),
    );
  },
};
