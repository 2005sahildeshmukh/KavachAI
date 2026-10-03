import {
  MockLoanSystemAdapter,
  collectionMatchesLoan,
  createLoanSystemState,
  type FailureMode,
  type LoanSystemState,
} from '../adapter/MockLoanSystemAdapter';
import { SIM_DATE, formatDate, inr } from '../domain/dates';
import { evaluateCase } from '../domain/eligibility';
import { evaluateEvidence } from '../domain/rules';
import type { ActivityEntry, CaseStatus, Hazard, Role, SupportCase, Variant } from '../domain/types';
import { HAZARD_LABEL, getEvidence } from '../fixtures/evidence';
import { BORROWERS, areaName, borrowerById, createLoans } from '../fixtures/portfolio';

/** Bump when the persisted shape changes. Older saved state is discarded. */
export const SCHEMA_VERSION = 1;

/**
 * One sandbox per hazard + evidence variant. Each has its own mock loan records,
 * cases and history, so nothing carries over from one event to another.
 */
export interface ScenarioState {
  hazard: Hazard;
  variant: Variant;
  eventId: string;
  system: LoanSystemState;
  cases: Record<string, SupportCase>;
  activity: ActivityEntry[];
  /** Applies to the next application attempt only, then returns to 'none'. */
  failureMode: FailureMode;
}

export interface AppState {
  schemaVersion: number;
  hazard: Hazard;
  variants: Record<Hazard, Variant>;
  scenarios: Record<string, ScenarioState>;
  role: Role;
}

type CaseActionType =
  | 'ACCEPT'
  | 'DECLINE'
  | 'REOPEN'
  | 'APPROVE'
  | 'REJECT'
  | 'APPLY_START'
  | 'APPLY_FINISH'
  | 'CHECK_STATUS'
  | 'REPEAT_REQUEST'
  | 'POST_PAYMENT'
  | 'REEVALUATE'
  | 'MESSAGE_PREVIEWED';

export type Action =
  | { type: 'SELECT_HAZARD'; hazard: Hazard; at?: string }
  | { type: 'SELECT_VARIANT'; variant: Variant; at?: string }
  | { type: 'RESET_SCENARIO'; at?: string }
  | { type: 'RESET_ALL'; at?: string }
  | { type: 'SET_ROLE'; role: Role; at?: string }
  | { type: 'SET_FAILURE_MODE'; mode: FailureMode; at?: string }
  /** `key` targets a specific sandbox; it defaults to the one on screen. */
  | { type: CaseActionType; borrowerId: string; key?: string; at?: string };

export const scenarioKey = (hazard: Hazard, variant: Variant) => `${hazard}:${variant}`;

export function currentScenario(state: AppState): ScenarioState {
  return state.scenarios[scenarioKey(state.hazard, state.variants[state.hazard])];
}

function log(sc: ScenarioState, at: string, entry: Omit<ActivityEntry, 'id' | 'at'>): void {
  sc.activity.push({ ...entry, id: `${sc.eventId}-${sc.activity.length + 1}`, at });
}

export function createScenario(hazard: Hazard, variant: Variant, at: string): ScenarioState {
  const evidence = getEvidence(hazard, variant);
  const evaluation = evaluateEvidence(evidence, SIM_DATE);
  const system = createLoanSystemState(createLoans());
  const sc: ScenarioState = { hazard, variant, eventId: evidence.eventId, system, cases: {}, activity: [], failureMode: 'none' };

  for (const b of BORROWERS) {
    const result = evaluateCase(b, system.loans[b.loanId], evidence, evaluation, areaName(b.areaId), SIM_DATE);
    sc.cases[b.id] = { borrowerId: b.id, eventId: evidence.eventId, superseded: [], ...result };
  }
  const opened = Object.values(sc.cases).filter((c) => c.status !== 'not_affected').length;
  log(sc, at, {
    kind: 'event',
    actor: 'system',
    title: `${HAZARD_LABEL[hazard]} evidence evaluated for ${areaName(evidence.areaId)}`,
    detail: `${evaluation.headline} ${opened} borrower${opened === 1 ? '' : 's'} in the area. Synthetic test fixture ${evidence.id}.`,
  });
  return sc;
}

export function initialState(at: string): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    hazard: 'heat',
    variants: { heat: 'qualifying', flood: 'qualifying', drought: 'qualifying' },
    scenarios: { [scenarioKey('heat', 'qualifying')]: createScenario('heat', 'qualifying', at) },
    role: 'officer',
  };
}

function withScenario(state: AppState, hazard: Hazard, variant: Variant, at: string, fresh = false): AppState {
  const key = scenarioKey(hazard, variant);
  const scenarios = fresh || !state.scenarios[key] ? { ...state.scenarios, [key]: createScenario(hazard, variant, at) } : state.scenarios;
  return { ...state, hazard, variants: { ...state.variants, [hazard]: variant }, scenarios };
}

const describe = (c: SupportCase) =>
  c.proposal
    ? `${inr(c.proposal.amount)} instalment: ${formatDate(c.proposal.originalDueDate)} to ${formatDate(c.proposal.newDueDate)}`
    : '';

/** Statuses in which an approval already exists for the current operation. */
const ALREADY_APPROVED: CaseStatus[] = ['approved', 'applying', 'applied', 'failed', 'unknown'];
/** Statuses in which a proposal is still open and can be invalidated by a payment. */
const PENDING: CaseStatus[] = ['proposal_ready', 'accepted', 'approved', 'failed'];

/** Success is recorded only when the loan committed and the collection record matches it. */
function confirmApplied(sc: ScenarioState, c: SupportCase, at: string, via: string): void {
  const adapter = new MockLoanSystemAdapter(sc.system);
  const p = c.proposal!;
  const loan = adapter.getLoan(p.loanId)!;
  const collection = adapter.getCollection(p.loanId);
  const op = adapter.getOperationStatus(p.operationId)!;
  const name = borrowerById(c.borrowerId)?.name ?? c.borrowerId;

  log(sc, at, {
    kind: 'loan_change',
    actor: 'system',
    borrowerId: c.borrowerId,
    operationId: p.operationId,
    title: `Mock loan system committed the change for ${name}`,
    detail: `${via} ${describe(c)}. Loan version is now ${op.committedVersion}. Original schedule retained.`,
  });

  if (!collectionMatchesLoan(loan, collection)) {
    c.status = 'failed';
    c.application = { attempts: c.application?.attempts ?? 1, lastMessage: 'The collection record does not match the loan schedule. Not confirmed.' };
    log(sc, at, {
      kind: 'collection',
      actor: 'system',
      borrowerId: c.borrowerId,
      operationId: p.operationId,
      title: 'Collection record mismatch',
      detail: 'The collection record does not match the revised schedule, so success is not confirmed.',
    });
    return;
  }

  const nextDemand = collection!.demands[0];
  c.status = 'applied';
  c.application = { attempts: c.application?.attempts ?? 1, lastMessage: 'Committed and matched to the collection record.', confirmedAt: at };
  log(sc, at, {
    kind: 'collection',
    actor: 'system',
    borrowerId: c.borrowerId,
    operationId: p.operationId,
    title: `Collection record updated for ${name}`,
    detail: nextDemand
      ? `Collection record matches the revised schedule. Next demand: ${inr(nextDemand.amount)} on ${formatDate(nextDemand.dueDate)}.`
      : 'Collection record matches the revised schedule.',
  });
}

function reduceCase(sc: ScenarioState, c: SupportCase, type: CaseActionType, at: string, role: Role): void {
  const adapter = new MockLoanSystemAdapter(sc.system);
  const b = borrowerById(c.borrowerId)!;
  const base = { borrowerId: c.borrowerId, operationId: c.proposal?.operationId };
  const blocked = (detail: string) =>
    log(sc, at, { ...base, kind: 'system', actor: 'system', title: `Action blocked for ${b.name}`, detail });

  switch (type) {
    case 'ACCEPT':
    case 'DECLINE': {
      if (c.status !== 'proposal_ready' || !c.proposal) return blocked('There is no open proposal for the borrower to answer.');
      const accepted = type === 'ACCEPT';
      c.status = accepted ? 'accepted' : 'declined';
      c.consent = { decision: accepted ? 'accepted' : 'declined', at, operationId: c.proposal.operationId };
      log(sc, at, {
        ...base,
        kind: 'acceptance',
        actor: 'borrower',
        title: `${b.name} ${accepted ? 'accepted' : 'declined'} the proposal`,
        detail: accepted ? `${describe(c)}. Waiting for lender approval.` : 'The loan schedule is unchanged.',
      });
      return;
    }

    case 'REOPEN': {
      if (c.status !== 'declined') return blocked('Only a declined proposal can be offered again.');
      c.status = 'proposal_ready';
      c.consent = undefined;
      log(sc, at, { ...base, kind: 'review', actor: role, title: `Proposal offered again to ${b.name}`, detail: 'A fresh borrower answer is needed.' });
      return;
    }

    case 'APPROVE':
    case 'REJECT': {
      if (ALREADY_APPROVED.includes(c.status)) {
        log(sc, at, {
          ...base,
          kind: 'approval',
          actor: 'approver',
          title: `Repeated approval ignored for ${b.name}`,
          detail: 'This operation is already approved. No second approval or benefit was created.',
        });
        return;
      }
      if (c.status !== 'accepted' || !c.proposal || c.consent?.operationId !== c.proposal.operationId) {
        return blocked('Lender approval needs a recorded borrower acceptance of the current proposal.');
      }
      const approved = type === 'APPROVE';
      c.status = approved ? 'approved' : 'rejected';
      c.approval = { decision: approved ? 'approved' : 'rejected', at, operationId: c.proposal.operationId, loanVersion: c.proposal.loanVersion };
      log(sc, at, {
        ...base,
        kind: 'approval',
        actor: 'approver',
        title: `Approver ${approved ? 'approved' : 'rejected'} the change for ${b.name}`,
        detail: approved ? `${describe(c)}. Not yet applied to the mock loan system.` : 'The loan schedule is unchanged.',
      });
      return;
    }

    case 'APPLY_START': {
      if ((c.status !== 'approved' && c.status !== 'failed') || !c.proposal || c.approval?.decision !== 'approved') {
        return blocked('Application to the mock loan system needs lender approval first.');
      }
      const attempts = (c.application?.attempts ?? 0) + 1;
      c.status = 'applying';
      c.application = { attempts, lastMessage: 'Request sent to the mock loan system.' };
      log(sc, at, {
        ...base,
        kind: 'system',
        actor: role,
        title: `Application requested for ${b.name}${attempts > 1 ? ` (attempt ${attempts})` : ''}`,
        detail: 'Sent with the same operation reference, so a retry cannot apply a second benefit.',
      });
      return;
    }

    case 'APPLY_FINISH': {
      if (c.status !== 'applying' || !c.proposal) return;
      const p = c.proposal;
      const result = adapter.applyRelief(
        { operationId: p.operationId, eventId: p.eventId, loanId: p.loanId, expectedVersion: p.loanVersion, instalmentId: p.instalmentId, newDueDate: p.newDueDate },
        sc.failureMode,
      );
      sc.failureMode = 'none';
      if (result.kind === 'committed') {
        confirmApplied(sc, c, at, result.duplicate ? 'Existing operation returned.' : 'New operation committed.');
      } else if (result.kind === 'rejected') {
        invalidate(sc, c, at, `The mock loan system refused the change: ${result.message}`);
      } else {
        c.status = result.kind;
        c.application = { attempts: c.application?.attempts ?? 1, lastMessage: result.message };
        log(sc, at, {
          ...base,
          kind: 'loan_change',
          actor: 'system',
          title: result.kind === 'failed' ? `Application failed for ${b.name}` : `Application outcome unknown for ${b.name}`,
          detail:
            result.kind === 'failed'
              ? `${result.message} The official schedule is unchanged. Retry uses the same operation reference.`
              : `${result.message} The existing operation must be queried before anything else is done.`,
        });
      }
      return;
    }

    case 'CHECK_STATUS': {
      if (c.status !== 'unknown' || !c.proposal) return blocked('There is no unknown outcome to check.');
      if (adapter.getOperationStatus(c.proposal.operationId)) {
        confirmApplied(sc, c, at, 'Status query found the existing operation. No new financial action was created.');
      } else {
        c.status = 'failed';
        c.application = { attempts: c.application?.attempts ?? 1, lastMessage: 'Status query found no committed operation. Safe to retry with the same reference.' };
        log(sc, at, { ...base, kind: 'loan_change', actor: 'system', title: `No committed operation for ${b.name}`, detail: c.application.lastMessage });
      }
      return;
    }

    case 'REPEAT_REQUEST': {
      if (c.status !== 'applied' || !c.proposal) return blocked('A repeat request can only be tested on an applied case.');
      const p = c.proposal;
      const before = adapter.getLoan(p.loanId)!.version;
      const result = adapter.applyRelief({ operationId: p.operationId, eventId: p.eventId, loanId: p.loanId, expectedVersion: p.loanVersion, instalmentId: p.instalmentId, newDueDate: p.newDueDate });
      const after = adapter.getLoan(p.loanId)!.version;
      log(sc, at, {
        ...base,
        kind: 'loan_change',
        actor: role,
        title: `Repeated request for ${b.name} returned the existing result`,
        detail:
          result.kind === 'committed' && result.duplicate && before === after
            ? `The mock loan system recognised the operation reference. Loan version stayed at ${after}. No second benefit was applied.`
            : 'Unexpected result from the mock loan system.',
      });
      return;
    }

    case 'POST_PAYMENT': {
      if (!PENDING.includes(c.status) || !c.proposal) return blocked('A payment can only be simulated while a proposal is pending.');
      const p = c.proposal;
      const updated = adapter.postPayment(p.loanId, p.instalmentId);
      if (!updated) return blocked('The targeted instalment could not be paid.');
      log(sc, at, {
        ...base,
        kind: 'collection',
        actor: 'system',
        title: `Payment posted for ${b.name}`,
        detail: `${inr(p.amount)} for the ${formatDate(p.originalDueDate)} instalment was posted in the mock loan system. Loan version is now ${updated.version}.`,
      });
      invalidate(sc, c, at, `A payment was posted after the proposal was prepared (loan version ${p.loanVersion} to ${updated.version}).`);
      return;
    }

    case 'REEVALUATE': {
      if (c.status !== 'review_required') return blocked('Only a case in review can be re-evaluated.');
      const evidence = getEvidence(sc.hazard, sc.variant);
      const result = evaluateCase(b, adapter.getLoan(b.loanId)!, evidence, evaluateEvidence(evidence, SIM_DATE), areaName(b.areaId), SIM_DATE);
      Object.assign(c, { ...result, proposal: result.proposal });
      log(sc, at, {
        borrowerId: c.borrowerId,
        operationId: result.proposal?.operationId,
        kind: 'review',
        actor: role,
        title: `Case re-evaluated for ${b.name}`,
        detail:
          result.status === 'proposal_ready'
            ? `A new proposal was prepared from the current loan record: ${describe(c)}. Fresh acceptance and approval are needed.`
            : `Still needs manual review. ${result.reviewReasons.join(' ')}`,
      });
      return;
    }

    case 'MESSAGE_PREVIEWED': {
      c.messagePreviewedAt = at;
      log(sc, at, {
        borrowerId: c.borrowerId,
        kind: 'message',
        actor: role,
        title: `Message preview shown for ${b.name}`,
        detail: 'Preview only. No message was sent. This is recorded separately from any loan change.',
      });
      return;
    }
  }
}

/** Returns a case to review. The old proposal, acceptance and approval stop being valid. */
function invalidate(sc: ScenarioState, c: SupportCase, at: string, reason: string): void {
  const operationId = c.proposal?.operationId;
  if (operationId) c.superseded.push(operationId);
  c.status = 'review_required';
  c.reviewReasons = [`${reason} The earlier proposal, acceptance and approval are no longer valid.`];
  c.proposal = undefined;
  c.consent = undefined;
  c.approval = undefined;
  c.application = undefined;
  log(sc, at, {
    borrowerId: c.borrowerId,
    operationId,
    kind: 'review',
    actor: 'system',
    title: `Proposal invalidated for ${borrowerById(c.borrowerId)?.name ?? c.borrowerId}`,
    detail: `${reason} Returned for review. Nothing was applied under the old proposal.`,
  });
}

export function reducer(state: AppState, action: Action): AppState {
  const at = action.at ?? '';
  switch (action.type) {
    case 'SELECT_HAZARD':
      return withScenario(state, action.hazard, state.variants[action.hazard], at);
    case 'SELECT_VARIANT':
      return withScenario(state, state.hazard, action.variant, at);
    case 'RESET_SCENARIO':
      return withScenario(state, state.hazard, state.variants[state.hazard], at, true);
    case 'RESET_ALL':
      return initialState(at);
    case 'SET_ROLE':
      return { ...state, role: action.role };
    case 'SET_FAILURE_MODE': {
      const key = scenarioKey(state.hazard, state.variants[state.hazard]);
      return { ...state, scenarios: { ...state.scenarios, [key]: { ...state.scenarios[key], failureMode: action.mode } } };
    }
    default: {
      const key = action.key ?? scenarioKey(state.hazard, state.variants[state.hazard]);
      if (!state.scenarios[key]) return state;
      const sc = structuredClone(state.scenarios[key]);
      const c = sc.cases[action.borrowerId];
      if (!c) return state;
      reduceCase(sc, c, action.type, at, state.role);
      return { ...state, scenarios: { ...state.scenarios, [key]: sc } };
    }
  }
}

/**
 * Restores saved state. A page closed mid-application has an unknown outcome,
 * so it is restored as "unknown" and must be resolved by a status query.
 */
export function rehydrate(saved: unknown, at: string): AppState {
  const s = saved as AppState | null;
  if (!s || s.schemaVersion !== SCHEMA_VERSION || !s.scenarios || !s.scenarios[scenarioKey(s.hazard, s.variants?.[s.hazard])]) {
    return initialState(at);
  }
  for (const sc of Object.values(s.scenarios)) {
    for (const c of Object.values(sc.cases)) {
      if (c.status === 'applying') c.status = 'unknown';
    }
  }
  return s;
}
