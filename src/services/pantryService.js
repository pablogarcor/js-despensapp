import { DomainError } from '../domain/errors.js';
import { createBackup, validateBackup } from '../domain/backup.js';
import {
  calculateShoppingList,
  calculateUnavailablePlannedMeals,
  findMissingMealSlots,
  sortPlannedMeals,
  toISODate,
} from '../domain/planning.js';
import { pantryServiceMethods } from './pantryService/pantry.js';
import { plannedMealServiceMethods } from './pantryService/plannedMeals.js';
import { recipeServiceMethods } from './pantryService/recipes.js';
import { shoppingServiceMethods } from './pantryService/shopping.js';
import {
  buildShoppingListWithState,
  normalizePlannedMeals,
  sortByName,
  sortShoppingExtras,
  sortShoppingItems,
} from './pantryService/helpers.js';

/**
 * Servicio de aplicacion que concentra reglas de negocio y restricciones.
 *
 * La UI no toca IndexedDB directamente: siempre pasa por este servicio para
 * mantener en un unico lugar las reglas de integridad entre tablas.
 */
export class PantryService {
  /**
   * @param {import('../storage/indexedDbClient.js').IndexedDbClient | import('../storage/memoryDatabase.js').MemoryDatabase} database
   * Persistencia compatible.
   * @param {Object} [options] Opciones para tests y escenarios deterministas.
   * @param {() => Date} [options.now] Proveedor de fecha actual.
   * @param {() => number} [options.random] Proveedor de aleatoriedad.
   */
  constructor(database, options = {}) {
    this.database = database;
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  /**
   * Devuelve todos los datos necesarios para pintar la pantalla.
   *
   * @returns {Promise<import('../domain/types.js').DashboardSnapshot>} Snapshot agregado.
   */
  async getDashboard() {
    const [pantryItems, recipes, allMeals, shoppingItems] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
      this.database.getAll('shoppingItems'),
    ]);
    const today = toISODate(this.now());
    const normalizedAllMeals = normalizePlannedMeals(allMeals);
    const plannedMeals = sortPlannedMeals(normalizedAllMeals.filter((meal) => meal.date >= today));
    const pendingMeals = sortPlannedMeals(normalizedAllMeals.filter((meal) => meal.date < today));
    const missingPlanSlots = findMissingMealSlots({
      plannedMeals,
      referenceDate: this.now(),
    });

    return {
      pantryItems: sortByName(pantryItems),
      recipes: sortByName(recipes),
      plannedMeals,
      pendingMeals,
      missingPlanSlots,
      shoppingList: buildShoppingListWithState({
        shoppingList: calculateShoppingList({ pantryItems, recipes, plannedMeals }),
        shoppingItems,
      }),
      shoppingExtras: sortShoppingExtras(shoppingItems),
      unavailableMeals: calculateUnavailablePlannedMeals({ pantryItems, recipes, plannedMeals }),
    };
  }

  /**
   * Exporta todos los datos locales de usuario a un backup versionado.
   *
   * @returns {Promise<import('../domain/types.js').PantryBackup>} Backup serializable.
   */
  async exportBackup() {
    const [pantryItems, recipes, plannedMeals, shoppingItems] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
      this.database.getAll('shoppingItems'),
    ]);

    return createBackup({
      pantryItems: sortByName(pantryItems),
      recipes: sortByName(recipes),
      plannedMeals: sortPlannedMeals(normalizePlannedMeals(plannedMeals)),
      shoppingItems: sortShoppingItems(shoppingItems),
      exportedAt: this.now().toISOString(),
    });
  }

  /**
   * Importa un backup JSON reemplazando datos de usuario actuales.
   *
   * @param {string} backupText Contenido JSON del archivo.
   * @returns {Promise<import('../domain/types.js').ImportSummary>} Resumen de importacion.
   */
  async importBackup(backupText) {
    let parsedBackup;

    try {
      parsedBackup = JSON.parse(backupText);
    } catch {
      throw new DomainError('El archivo no es un JSON valido.', 'BACKUP_JSON_INVALID');
    }

    const backupData = validateBackup(parsedBackup);

    await this.database.replaceStores({
      pantryItems: backupData.pantryItems,
      recipes: backupData.recipes,
      plannedMeals: backupData.plannedMeals,
      shoppingItems: backupData.shoppingItems,
    });

    return {
      pantryItems: backupData.pantryItems.length,
      recipes: backupData.recipes.length,
      plannedMeals: backupData.plannedMeals.length,
      shoppingItems: backupData.shoppingItems.length,
    };
  }

  /**
   * Borra todos los datos principales de usuario sin validar dependencias.
   *
   * Esta operacion se usa para reiniciar la app completa, por eso limpia las
   * tablas relacionadas en una sola accion y mantiene la tabla `meta`.
   *
   * @returns {Promise<import('../domain/types.js').ImportSummary>} Totales eliminados por tabla.
   */
  async clearAllData() {
    const [pantryItems, recipes, plannedMeals, shoppingItems] = await Promise.all([
      this.database.getAll('pantryItems'),
      this.database.getAll('recipes'),
      this.database.getAll('plannedMeals'),
      this.database.getAll('shoppingItems'),
    ]);

    await this.database.replaceStores({
      pantryItems: [],
      recipes: [],
      plannedMeals: [],
      shoppingItems: [],
    });

    return {
      pantryItems: pantryItems.length,
      recipes: recipes.length,
      plannedMeals: plannedMeals.length,
      shoppingItems: shoppingItems.length,
    };
  }
}

Object.assign(
  PantryService.prototype,
  shoppingServiceMethods,
  pantryServiceMethods,
  recipeServiceMethods,
  plannedMealServiceMethods,
);
