# DespensApp

MVP mobile first para gestionar una despensa local, crear recetas con alimentos existentes y planificar las comidas de la siguiente semana. La app funciona sin backend: los datos se guardan en IndexedDB dentro del navegador.

## Decisiones tecnicas

- **Vite + JavaScript nativo**: Vite se usa solo como servidor de desarrollo y bundler. No hay framework de UI porque el MVP no necesita router, estado global ni componentes complejos.
- **IndexedDB**: es persistente, funciona en navegadores moviles modernos y permite modelar tablas locales sin servidor.
- **PWA nativa sin plugin**: se usa un `manifest.webmanifest`, un service worker propio e iconos locales. No se anade `vite-plugin-pwa` porque el caso actual se resuelve con pocas APIs estandar.
- **`asset-manifest.json` de Vite**: el build emite un manifest de assets para que el service worker pueda precachear los archivos con hash sin hardcodearlos.
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
- No se puede vaciar la despensa si alguna receta usa alimentos guardados.
- Se puede borrar todo desde configuracion para reiniciar despensa, recetas y comidas planificadas a la vez.
- Se puede sumar o restar cantidad a un alimento existente manteniendo su unidad.
- Al restar stock manualmente, la cantidad nunca baja de cero.
- Se puede editar nombre, cantidad y unidad de un alimento existente conservando su identificador.
- Si cambias la unidad de un alimento usado en recetas, debes revisar y guardar la cantidad por racion de cada receta afectada.
- No se puede borrar una receta si esta planificada.
- No se pueden vaciar recetas si alguna esta planificada.
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
├── .github
│   └── workflows
│       └── deploy-pages.yml # CI/CD hacia GitHub Pages
├── index.html
├── public
│   ├── manifest.webmanifest # Metadatos de instalacion PWA
│   ├── offline.html         # Fallback si no hay shell cacheado
│   ├── sw.js                # Service worker de cache offline
│   └── icons                # Iconos Android/iOS y maskable
├── scripts
│   └── generate-pwa-icons.js # Generador de iconos PNG sin dependencias
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
│   ├── pwa
│   │   └── registerServiceWorker.js # Registro seguro del service worker
│   ├── ui
│   │   └── PantryApp.js       # Controlador y render de la SPA
│   ├── main.js                # Bootstrap de la app
│   └── styles.css             # UI mobile first
├── vite.config.js             # Build manifest para precache PWA
└── tests
    └── pantryService.test.js  # Tests de reglas criticas
```

## Puesta en marcha

```bash
npm install
npm run dev
```

Vite mostrara una URL local. En movil, usa la URL de red que imprime Vite si el telefono esta en la misma red que el ordenador.

Para probar instalacion PWA real en movil hace falta servir la app por HTTPS. Los navegadores permiten service workers en `localhost`, pero no suelen permitirlos en una IP local con HTTP. Para iOS y Android, despliega el build en una web HTTPS y despues:

- Android Chrome: menu del navegador -> **Instalar app** o **añadir a pantalla de inicio**.
- iOS Safari: compartir -> **añadir a pantalla de inicio**.

## Scripts

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de produccion
npm run build:github-pages # build con base /js-despensapp/
npm run preview  # previsualizacion del build
npm run pwa:icons # regenera los iconos PNG de la PWA
npm test         # tests de negocio con node:test
```

## PWA y uso offline

La PWA se compone de:

- `public/manifest.webmanifest`: nombre, colores, `start_url`, `scope`, modo `standalone` e iconos.
- `public/sw.js`: service worker con cache offline.
- `src/pwa/registerServiceWorker.js`: registro solo en build de produccion y en origen seguro.
- `public/icons/*`: iconos PNG para Android/iOS, icono maskable y SVG base.

El service worker usa dos estrategias:

- **Network-first para navegaciones**: si hay conexion, descarga la version actual de la app; si no hay conexion, abre el shell cacheado.
- **Cache-first para assets**: CSS, JS, iconos y manifest se sirven desde cache cuando ya existen.

Los datos siguen viviendo en IndexedDB. La PWA permite abrir la app offline tras una primera carga con conexion, pero no sincroniza datos entre dispositivos.

## Despliegue en GitHub Pages

El repositorio esta preparado para desplegarse como sitio de proyecto en:

```text
https://pablogarcor.github.io/js-despensapp/
```

La configuracion vive en `.github/workflows/deploy-pages.yml`. En cada push a `master`, GitHub Actions:

1. Instala dependencias con `npm ci`.
2. Ejecuta `npm test`.
3. Genera el build con `npm run build:github-pages`.
4. Publica `dist/` con el flujo oficial de GitHub Pages.

Configuracion necesaria en GitHub:

1. Entra en **Settings > Pages**.
2. En **Build and deployment**, selecciona **Source: GitHub Actions**.
3. No configures **Custom domain** mientras no quieras dominio propio.
4. Haz push a `master` y revisa el workflow en la pestana **Actions**.

`npm run build:github-pages` usa `--base=/js-despensapp/`, necesario porque GitHub Pages sirve este repositorio bajo un subdirectorio. La PWA usa rutas relativas al scope, asi que manifest, iconos y service worker funcionan tanto en local como en GitHub Pages.

Si el deploy falla con `HttpError: Not Found` y el mensaje `Ensure GitHub Pages has been enabled`, el build ya se ha generado pero GitHub Pages no esta activado para el repositorio. Revisa de nuevo **Settings > Pages > Source: GitHub Actions** y vuelve a ejecutar el workflow. Los avisos de runtime de Node en las actions no son ese fallo; el workflow usa las majors actuales de las actions oficiales para evitar depender de Node 20.

## Flujo de uso

1. En **Despensa**, anade alimentos con cantidad y unidad.
2. Si compras mas de un alimento existente, usa **Sumar** en su tarjeta para incrementar el stock sin duplicarlo.
3. Si un alimento se gasta fuera del plan o se pone malo, usa **Restar** para descontarlo manualmente.
4. Usa **Editar** en un alimento para corregir nombre, cantidad total o unidad. Si aparece en recetas, veras esas recetas en el mismo formulario para ajustar sus cantidades.
5. Usa **Vaciar despensa** para eliminar todos los alimentos si no estan usados en recetas.
6. En **Recetas**, crea recetas usando solo alimentos existentes. Cada ingrediente representa cantidad por racion.
7. Usa **Editar** en una receta para modificar ingredientes, cantidades, nombre o momentos del dia.
8. Usa **Vaciar recetas** para eliminar todas las recetas si no estan planificadas.
9. En **Plan**, la app muestra por defecto los huecos de los proximos 7 dias para poder añadir comidas manualmente.
10. Si prefieres automatizar, indica raciones y pulsa **Planificar semana** para rellenar todos los huecos.
11. Si eliminas una comida del plan, el hueco vuelve a aparecer dentro de su dia con un selector de recetas compatibles.
12. Pulsa **Completar huecos** para rellenar automaticamente los huecos restantes sin borrar las comidas ya planificadas.
13. Usa **Editar** en una comida planificada para cambiar receta o raciones.
14. Si falta comida, la **lista de la compra** aparece cerrada por defecto pero indica claramente si falta compra o si el plan esta cubierto.
15. Las comidas del plan que no se podrian cocinar quedan marcadas en su tarjeta para verlo de un vistazo.
16. Al desplegar la lista de compra, muestra alimentos agregados por unidad y las **comidas afectadas**, con receta, fecha, franja y faltas concretas.
17. Cuando una comida ya paso, la app la muestra como pendiente: si marcas **Hecha**, descuenta ingredientes; si marcas **No hecha**, solo elimina la planificacion.
18. En **Configuracion**, usa **Exportar copia** para descargar un backup JSON o **Importar y reemplazar** para restaurarlo.
19. Usa **Borrar todo** en **Configuracion** para reiniciar despensa, recetas y planificacion.

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
- No hay sincronizacion en segundo plano, notificaciones push ni actualizaciones silenciosas de datos.
- Los datos demo se insertan solo la primera vez para facilitar pruebas.

## Siguientes pasos recomendados

- Conversor de unidades controlado.
- Historial de comidas hechas.
- Sincronizacion opcional entre dispositivos.
