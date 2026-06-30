import { actionSheetRenderMethods } from './actionSheet.js';
import { iconRenderMethods } from './icons.js';
import { pendingMealsRenderMethods } from './pendingMealsView.js';
import { searchControlRenderMethods } from './searchControl.js';
import { sharedControlRenderMethods } from './sharedControls.js';

/**
 * Agrega los metodos de render transversales usados por varias pantallas.
 */
export const commonRenderMethods = {
  ...iconRenderMethods,
  ...actionSheetRenderMethods,
  ...sharedControlRenderMethods,
  ...pendingMealsRenderMethods,
  ...searchControlRenderMethods,
};
