import type { CollectionDemand } from '../adapter/MockLoanSystemAdapter';
import type { ScenarioState } from './reducer';

/**
 * The next demand Kavach can honestly show for a borrower. While an application
 * is in flight or its outcome is unknown, Kavach has not confirmed any change,
 * so it keeps showing the schedule the proposal was prepared against.
 */
export function knownNextDemand(scenario: ScenarioState, borrowerId: string, loanId: string): CollectionDemand | undefined {
  const c = scenario.cases[borrowerId];
  if (c?.proposal && (c.status === 'applying' || c.status === 'unknown')) {
    const next = c.proposal.originalSchedule.filter((i) => i.status === 'unpaid').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    return next && { instalmentId: next.id, dueDate: next.dueDate, amount: next.amount };
  }
  return scenario.system.collections[loanId]?.demands[0];
}
