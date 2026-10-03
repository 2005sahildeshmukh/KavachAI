import { applyDeferral } from '../domain/schedule';
import type { Instalment, Loan } from '../domain/types';

/**
 * Proposed interface between Kavach and a lender's loan system.
 * These operation names are our own. They are not Satin endpoint names.
 * A future integration would implement this interface against a supported API
 * or an authorised staff workflow; the lender's system stays authoritative.
 */
export interface LoanSystemAdapter {
  getLoan(loanId: string): Loan | undefined;
  getCollection(loanId: string): CollectionRecord | undefined;
  previewRelief(loanId: string, instalmentId: string, newDueDate: string): Instalment[];
  applyRelief(request: ApplyRequest, failureMode?: FailureMode): ApplyResult;
  getOperationStatus(operationId: string): OperationRecord | undefined;
}

export interface CollectionDemand {
  instalmentId: string;
  dueDate: string;
  amount: number;
}

/** What the collections side would ask the borrower to pay. */
export interface CollectionRecord {
  loanId: string;
  loanVersion: number;
  demands: CollectionDemand[];
}

export interface OperationRecord {
  operationId: string;
  eventId: string;
  loanId: string;
  instalmentId: string;
  newDueDate: string;
  committedVersion: number;
}

export interface LoanSystemState {
  loans: Record<string, Loan>;
  collections: Record<string, CollectionRecord>;
  operations: Record<string, OperationRecord>;
}

export interface ApplyRequest {
  operationId: string;
  eventId: string;
  loanId: string;
  expectedVersion: number;
  instalmentId: string;
  newDueDate: string;
}

export type RejectCode = 'LOAN_NOT_FOUND' | 'STALE_VERSION' | 'INSTALMENT_NOT_UNPAID' | 'RELIEF_ALREADY_APPLIED';

export type ApplyResult =
  | { kind: 'committed'; operation: OperationRecord; duplicate: boolean }
  | { kind: 'rejected'; code: RejectCode; message: string }
  /** The system failed before committing. Nothing changed. */
  | { kind: 'failed'; message: string }
  /** The response was lost. The caller cannot tell whether the change committed. */
  | { kind: 'unknown'; message: string };

/** Controlled failure injection for the demo. */
export type FailureMode = 'none' | 'fail' | 'unknown';

function buildCollection(loan: Loan): CollectionRecord {
  return {
    loanId: loan.id,
    loanVersion: loan.version,
    demands: loan.instalments
      .filter((i) => i.status === 'unpaid')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((i) => ({ instalmentId: i.id, dueDate: i.dueDate, amount: i.amount })),
  };
}

/** True when the collection record asks for exactly the loan's unpaid instalments. */
export function collectionMatchesLoan(loan: Loan, collection: CollectionRecord | undefined): boolean {
  if (!collection) return false;
  return JSON.stringify(collection) === JSON.stringify(buildCollection(loan));
}

export function createLoanSystemState(loans: Loan[]): LoanSystemState {
  const state: LoanSystemState = { loans: {}, collections: {}, operations: {} };
  for (const loan of loans) {
    state.loans[loan.id] = loan;
    state.collections[loan.id] = buildCollection(loan);
  }
  return state;
}

/**
 * In-browser stand-in for a loan system. It is the authority for schedules inside the demo.
 * It shows the intended behaviour only. It makes no production concurrency guarantees.
 */
export class MockLoanSystemAdapter implements LoanSystemAdapter {
  constructor(private state: LoanSystemState) {}

  getLoan(loanId: string): Loan | undefined {
    return this.state.loans[loanId];
  }

  getCollection(loanId: string): CollectionRecord | undefined {
    return this.state.collections[loanId];
  }

  previewRelief(loanId: string, instalmentId: string, newDueDate: string): Instalment[] {
    const loan = this.state.loans[loanId];
    if (!loan) throw new Error(`Loan ${loanId} not found`);
    return applyDeferral(loan.instalments, instalmentId, newDueDate);
  }

  applyRelief(request: ApplyRequest, failureMode: FailureMode = 'none'): ApplyResult {
    // Same operation ID: return the existing result. Never apply a second benefit.
    const existing = this.state.operations[request.operationId];
    if (existing) return { kind: 'committed', operation: existing, duplicate: true };

    if (failureMode === 'fail') {
      return { kind: 'failed', message: 'Mock loan system unavailable. Nothing was committed.' };
    }

    const loan = this.state.loans[request.loanId];
    if (!loan) return { kind: 'rejected', code: 'LOAN_NOT_FOUND', message: `Loan ${request.loanId} not found.` };
    if (loan.reliefEventIds.includes(request.eventId)) {
      return { kind: 'rejected', code: 'RELIEF_ALREADY_APPLIED', message: 'Relief for this event is already on the loan.' };
    }
    if (loan.version !== request.expectedVersion) {
      return {
        kind: 'rejected',
        code: 'STALE_VERSION',
        message: `Loan changed since the proposal (version ${request.expectedVersion} expected, ${loan.version} found).`,
      };
    }
    const target = loan.instalments.find((i) => i.id === request.instalmentId);
    if (!target || target.status !== 'unpaid') {
      return { kind: 'rejected', code: 'INSTALMENT_NOT_UNPAID', message: 'The targeted instalment is no longer unpaid.' };
    }

    // Commit: schedule, version, collection record and operation log change together.
    const updated: Loan = {
      ...loan,
      instalments: applyDeferral(loan.instalments, request.instalmentId, request.newDueDate),
      version: loan.version + 1,
      reliefEventIds: [...loan.reliefEventIds, request.eventId],
    };
    const operation: OperationRecord = {
      operationId: request.operationId,
      eventId: request.eventId,
      loanId: loan.id,
      instalmentId: request.instalmentId,
      newDueDate: request.newDueDate,
      committedVersion: updated.version,
    };
    this.state.loans[loan.id] = updated;
    this.state.collections[loan.id] = buildCollection(updated);
    this.state.operations[operation.operationId] = operation;

    if (failureMode === 'unknown') {
      return { kind: 'unknown', message: 'No response from the mock loan system. The outcome is not known.' };
    }
    return { kind: 'committed', operation, duplicate: false };
  }

  getOperationStatus(operationId: string): OperationRecord | undefined {
    return this.state.operations[operationId];
  }

  /** Demo control: a payment arrives in the loan system outside Kavach. */
  postPayment(loanId: string, instalmentId: string): Loan | undefined {
    const loan = this.state.loans[loanId];
    const target = loan?.instalments.find((i) => i.id === instalmentId);
    if (!loan || !target || target.status !== 'unpaid') return undefined;
    const updated: Loan = {
      ...loan,
      instalments: loan.instalments.map((i) => (i.id === instalmentId ? { ...i, status: 'paid' as const } : i)),
      version: loan.version + 1,
    };
    this.state.loans[loanId] = updated;
    this.state.collections[loanId] = buildCollection(updated);
    return updated;
  }
}
