import { addMonths, daysBetween } from './dates';
import type { Instalment, Loan } from './types';

/** First unpaid instalment that is not yet due on the simulation date. */
export function findTargetInstalment(loan: Loan, simDate: string): Instalment | undefined {
  return [...loan.instalments]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .find((i) => i.status === 'unpaid' && daysBetween(simDate, i.dueDate) > 0);
}

/** Unpaid instalments already past their due date. */
export function overdueInstalments(loan: Loan, simDate: string): Instalment[] {
  return loan.instalments.filter((i) => i.status === 'unpaid' && daysBetween(i.dueDate, simDate) > 0);
}

/** One normal payment interval (a month) after the last scheduled due date. */
export function deferredDueDate(instalments: Instalment[]): string {
  const last = instalments.map((i) => i.dueDate).sort().at(-1) as string;
  return addMonths(last, 1);
}

/**
 * Moves one unpaid instalment to a new due date. The original row stays as ₹0 "deferred"
 * and a new row carries the full amount. The payment is postponed, not forgiven.
 */
export function applyDeferral(instalments: Instalment[], instalmentId: string, newDueDate: string): Instalment[] {
  const target = instalments.find((i) => i.id === instalmentId);
  if (!target || target.status !== 'unpaid') {
    throw new Error(`Instalment ${instalmentId} is not an unpaid instalment`);
  }
  const moved: Instalment = {
    id: `${target.id}-D`,
    dueDate: newDueDate,
    amount: target.amount,
    status: 'unpaid',
    movedFrom: target.dueDate,
  };
  return [
    ...instalments.map((i) =>
      i.id === instalmentId ? { ...i, amount: 0, status: 'deferred' as const, movedTo: newDueDate } : i,
    ),
    moved,
  ];
}

/** Total still payable by the borrower. */
export function remainingTotal(instalments: Instalment[]): number {
  return instalments.filter((i) => i.status === 'unpaid').reduce((sum, i) => sum + i.amount, 0);
}

export interface CompareRow {
  dueDate: string;
  before: number | null;
  after: number | null;
  note?: 'Deferred' | 'Moved here' | 'Paid';
}

/** Side-by-side rows for a before/after schedule, ordered by due date. */
export function compareSchedules(before: Instalment[], after: Instalment[]): CompareRow[] {
  const beforeById = new Map(before.map((i) => [i.id, i]));
  const rows: CompareRow[] = after
    .filter((a) => a.status !== 'paid' || beforeById.get(a.id)?.status !== 'paid')
    .map((a) => {
      const b = beforeById.get(a.id);
      return {
        dueDate: a.dueDate,
        before: b ? b.amount : null,
        after: a.status === 'paid' ? 0 : a.amount,
        note: a.status === 'deferred' ? 'Deferred' : a.movedFrom && !b ? 'Moved here' : a.status === 'paid' ? 'Paid' : undefined,
      };
    });
  return rows.sort((x, y) => x.dueDate.localeCompare(y.dueDate));
}
