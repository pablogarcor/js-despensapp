import { fromISODate } from '../../domain/planning.js';
import { getPlanDaySummaries } from '../renderUtils.js';
import { planGroupRenderMethods } from './planGroupsView.js';
import { plannedMealEditorRenderMethods } from './plannedMealEditorView.js';

/**
 * Metodos de render de la vista principal de planificacion.
 */
export const planViewMethods = {
  renderPlanView(dashboard) {
    const isActionsOpen = this.state.planActionsOpen;
    const days = getPlanDaySummaries(dashboard);
    const planRange = formatPlanRange(days);

    return `
      <section class="panel action-panel plan-toolbar">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Siguiente semana</p>
            <h3>Huecos del plan</h3>
          </div>
        </div>

        ${this.renderPlanDayStrip(dashboard)}
      </section>

      ${isActionsOpen ? this.renderPlanActionsSheet() : ''}
      ${
        isActionsOpen
          ? ''
          : this.renderFloatingActionButton({
              action: 'show-plan-actions',
              label: 'Acciones del plan',
              icon: 'action',
              className: 'plan-fab',
            })
      }
      ${this.renderPlannedMealSheet(dashboard)}

      ${this.renderShoppingPlanSummary(dashboard)}

      <section class="plan-list-heading">
        <h2>Plan Semanal</h2>
        ${planRange ? `<span class="plan-range">${planRange}</span>` : ''}
      </section>

      <section class="list-section" aria-label="Comidas planificadas">
        ${
          dashboard.plannedMeals.length === 0 && dashboard.missingPlanSlots.length === 0
            ? this.renderEmptyState('Aun no hay planificacion.')
            : ''
        }
        ${this.renderPlanGroups(dashboard)}
      </section>
    `;
  },

  renderPlanActionsSheet() {
    return this.renderActionSheet({
      title: 'Acciones del plan',
      titleId: 'plan-actions-title',
      dismissAction: 'hide-plan-actions',
      form: {
        className: 'action-sheet-form',
        dataForm: 'plan-week',
        hiddenInputs: [{ name: 'servings', value: '1' }],
      },
      actions: [
        {
          label: 'Planificar semana',
          icon: 'weeklyPlan',
          type: 'submit',
          variant: 'primary',
          data: { planMode: 'reset' },
        },
        {
          label: 'Completar huecos',
          icon: 'autoFill',
          type: 'submit',
          data: { planMode: 'complete' },
        },
        {
          label: 'Vaciar plan',
          icon: 'delete',
          action: 'clear-plan',
          variant: 'danger',
        },
        {
          label: 'Ocultar acciones',
          icon: 'chevronDown',
          action: 'hide-plan-actions',
          separated: true,
        },
      ],
    });
  },

  ...plannedMealEditorRenderMethods,
  ...planGroupRenderMethods,
};

/**
 * Formatea el rango visible de la semana planificada.
 *
 * @param {Array<{date: string}>} days Resumenes de dias.
 * @returns {string} Rango visible.
 */
function formatPlanRange(days) {
  if (days.length === 0) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  });

  return `${formatter.format(fromISODate(days[0].date))} - ${formatter.format(fromISODate(days.at(-1).date))}`;
}
