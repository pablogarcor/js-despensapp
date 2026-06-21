# Despensapp

MVP mobile first para gestionar una despensa local, crear recetas con alimentos existentes y planificar las comidas de la siguiente semana. La app funciona sin backend: los datos se guardan en IndexedDB dentro del navegador.

## Decisiones tecnicas

- **Vite + JavaScript nativo**: Vite se usa solo como servidor de desarrollo y bundler. No hay framework de UI porque el MVP no necesita router, estado global ni componentes complejos.
- **IndexedDB**: es persistente, funciona en navegadores moviles modernos y permite modelar tablas locales sin servidor.
- **JSDoc**: documenta tipos, servicios y funciones sin introducir TypeScript en esta fase.
- **Node test runner**: los tests usan `node:test`, asi que no se anade Vitest/Jest para mantener pocas dependencias.
- **`overrides.esbuild`**: fuerza una version no vulnerable de una dependencia transitiva de Vite. Se mantiene acotado para no introducir mas librerias.

## Modelo de datos

### `pantryItems`

Alimentos disponibles en la despensa.

- `id`: identificador local.
- `name`: nombre del alimento.
- `quantity`: cantidad disponible.
- `unit`: unidad usada para ese alimento.
- `createdAt`, `updatedAt`: auditoria local.

### `recipes`

Recetas predefinidas o creadas por el usuario.

- `id`: identificador local.
- `name`: nombre.
- `mealTypes`: momentos del dia compatibles: `breakfast`, `lunch`, `dinner`.
- `ingredients`: lista de `{ pantryItemId, quantity }`, donde `quantity` es la cantidad por racion.

Regla importante: todos los ingredientes deben existir previamente en `pantryItems`.

### `plannedMeals`

Comidas planificadas.

- `id`: identificador local.
- `date`: fecha `YYYY-MM-DD`.
- `mealType`: desayuno, comida o cena.
- `recipeId`: receta planificada.
- `servings`: raciones.

La planificacion automatica genera 7 dias desde manana, con desayuno, comida y cena. Las comidas pasadas se mantienen hasta que el usuario confirme si se hicieron.

## Reglas de integridad

Las reglas viven en `src/services/pantryService.js`:

- No se puede borrar un alimento si alguna receta lo usa.
- Se puede sumar o restar cantidad a un alimento existente manteniendo su unidad.
- Al restar stock manualmente, la cantidad nunca baja de cero.
- Se puede editar nombre, cantidad y unidad de un alimento existente conservando su identificador.
- Si cambias la unidad de un alimento usado en recetas, debes revisar y guardar la cantidad por racion de cada receta afectada.
- No se puede borrar una receta si esta planificada.
- Se puede editar una receta existente para cambiar nombre, momentos del dia, ingredientes y cantidades.
- Una receta planificada no puede perder una franja si ya hay comidas planificadas de esa receta en esa franja.
- No puede haber dos comidas planificadas en la misma fecha y momento del dia.
- Una comida manual solo puede usar recetas compatibles con su momento del dia.
- Una comida editada conserva su fecha y momento del dia; solo puede cambiar receta y raciones.
- Una comida editada solo puede usar una receta compatible con su momento del dia.
- Una receta no puede repetir el mismo alimento.
- Una comida hecha descuenta `cantidad por racion * raciones`.
- La despensa no baja de cero si se confirma una comida aunque falten alimentos.
- La lista de la compra se calcula agregando todo lo que requiere el plan futuro y comparandolo con la despensa.
- La lista de la compra tambien senala que comidas del plan no se podrian preparar, indicando receta, fecha, franja y alimentos que faltan.

## Estructura

```text
.
├── index.html
├── src
│   ├── domain
│   │   ├── backup.js          # Validacion y creacion de backups JSON
│   │   ├── errors.js          # Error de negocio reusable
│   │   ├── planning.js        # Fechas, calculos y generacion de plan
│   │   └── types.js           # Tipos JSDoc y constantes
│   ├── services
│   │   └── pantryService.js   # Reglas de negocio e integridad
│   ├── storage
│   │   ├── indexedDbClient.js # Adaptador IndexedDB
│   │   ├── memoryDatabase.js  # Adaptador para tests
│   │   └── seedData.js        # Datos demo iniciales
│   ├── ui
│   │   └── PantryApp.js       # Controlador y render de la SPA
│   ├── main.js                # Bootstrap de la app
│   └── styles.css             # UI mobile first
└── tests
    └── pantryService.test.js  # Tests de reglas criticas
```

## Puesta en marcha

```bash
npm install
npm run dev
```

Vite mostrara una URL local. En movil, usa la URL de red que imprime Vite si el telefono esta en la misma red que el ordenador.

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de produccion
npm run preview  # previsualizacion del build
npm test         # tests de negocio con node:test
```

## Flujo de uso

1. En **Despensa**, anade alimentos con cantidad y unidad.
2. Si compras mas de un alimento existente, usa **Sumar** en su tarjeta para incrementar el stock sin duplicarlo.
3. Si un alimento se gasta fuera del plan o se pone malo, usa **Restar** para descontarlo manualmente.
4. Usa **Editar** en un alimento para corregir nombre, cantidad total o unidad. Si aparece en recetas, veras esas recetas en el mismo formulario para ajustar sus cantidades.
5. En **Recetas**, crea recetas usando solo alimentos existentes. Cada ingrediente representa cantidad por racion.
6. Usa **Editar** en una receta para modificar ingredientes, cantidades, nombre o momentos del dia.
7. En **Plan**, indica raciones y pulsa **Planificar semana**.
8. La app rellena los proximos 7 dias y calcula si falta algo.
9. Si eliminas una comida del plan, el hueco aparece dentro de su dia con un selector de recetas compatibles para anadirla manualmente.
10. Pulsa **Completar huecos** para rellenar automaticamente los huecos restantes sin borrar las comidas ya planificadas.
11. Usa **Editar** en una comida planificada para cambiar receta o raciones.
12. Si falta comida, la **lista de la compra** aparece cerrada por defecto pero indica claramente si falta compra o si el plan esta cubierto.
13. Las comidas del plan que no se podrian cocinar quedan marcadas en su tarjeta para verlo de un vistazo.
14. Al desplegar la lista de compra, muestra alimentos agregados por unidad y las **comidas afectadas**, con receta, fecha, franja y faltas concretas.
15. Cuando una comida ya paso, la app la muestra como pendiente: si marcas **Hecha**, descuenta ingredientes; si marcas **No hecha**, solo elimina la planificacion.
16. En **Configuracion**, usa **Exportar copia** para descargar un backup JSON o **Importar y reemplazar** para restaurarlo.

## Importar y exportar

La app exporta un JSON con:

- `app: "despensapp"`.
- `schemaVersion: 1`.
- `exportedAt`.
- `data.pantryItems`.
- `data.recipes`.
- `data.plannedMeals`.

La importacion valida estructura, ids duplicados y relaciones entre alimentos, recetas y comidas antes de reemplazar los datos actuales. En este MVP la importacion siempre es de tipo **reemplazar**, no fusionar.

## Limitaciones conscientes del MVP

- No hay conversion automatica entre unidades. Una receta usa la misma unidad definida por cada alimento.
- No hay sincronizacion entre dispositivos ni usuarios.
- Los datos demo se insertan solo la primera vez para facilitar pruebas.

## Siguientes pasos recomendados

- Conversor de unidades controlado.
- Historial de comidas hechas.
- PWA instalable y cache offline.
