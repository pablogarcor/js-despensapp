import './styles.css';
import { PantryService } from './services/pantryService.js';
import { IndexedDbClient } from './storage/indexedDbClient.js';
import { seedDemoData } from './storage/seedData.js';
import { PantryApp } from './ui/PantryApp.js';

const root = document.querySelector('#app');
const database = new IndexedDbClient();
const service = new PantryService(database);
const app = new PantryApp({ root, service });

await database.open();
await seedDemoData(database);
await app.start();
