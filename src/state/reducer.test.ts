import { describe, expect, it } from 'vitest';
import { remainingTotal } from '../domain/schedule';
import type { Hazard } from '../domain/types';
import { currentScenario, initialState, reducer, rehydrate, type Action, type AppState } from './reducer';
import { knownNextDemand } from './selectors';

const AT = '2026-05-12T09:00:00.000Z';
const S = 'B01'; // Sunita

const run = (state: AppState, ...actions: Action[]) => actions.reduce((s, a) => reducer(s, { ...a, at: AT }), state);
const start = () => initialState(AT);
const sunita = (s: AppState) => currentScenario(s).cases[S];
const loan = (s: AppState, id = 'L01') => currentScenario(s).system.loans[id];
const act = (type: Extract<Action, { borrowerId: string }>['type'], borrowerId = S): Action => ({ type, borrowerId });

const approved = () => run(start(), act('ACCEPT'), act('APPROVE'));
const applied = () => run(approved(), act('APPLY_START'), act('APPLY_FINISH'));

describe('successful journey', () => {
  it('starts on heat with a proposal for Sunita', () => {
    const s = start();
    expect(s.hazard).toBe('heat');
    expect(sunita(s).status).toBe('proposal_ready');
  });

  it('moves May to August and keeps the total at ₹4,500', () => {
    const s = applied();
    expect(sunita(s).status).toBe('applied');
    const inst = loan(s).instalments;
    expect(inst.find((i) => i.dueDate === '2026-05-15')).toMatchObject({ amount: 0, status: 'deferred' });
    expect(inst.find((i) => i.dueDate === '2026-08-15')).toMatchObject({ amount: 1500, status: 'unpaid' });
    expect(remainingTotal(inst)).toBe(4500);
    expect(remainingTotal(sunita(s).proposal!.originalSchedule)).toBe(4500);
    expect(currentScenario(s).system.collections.L01.demands[0].dueDate).toBe('2026-06-15');
    const kinds = currentScenario(s).activity.map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['event', 'acceptance', 'approval', 'loan_change', 'collection']));
  });

  it.each<[Hazard, string, string]>([
    ['heat', 'B01', 'L01'],
    ['flood', 'B06', 'L06'],
    ['drought', 'B11', 'L11'],
  ])('completes for the %s scenario', (hazard, borrowerId, loanId) => {
    const s = run(start(), { type: 'SELECT_HAZARD', hazard }, act('ACCEPT', borrowerId), act('APPROVE', borrowerId), act('APPLY_START', borrowerId), act('APPLY_FINISH', borrowerId));
    expect(currentScenario(s).cases[borrowerId].status).toBe('applied');
    expect(loan(s, loanId).version).toBe(2);
    expect(remainingTotal(loan(s, loanId).instalments)).toBe(4500);
  });
});

describe('ordering rules', () => {
  it('blocks approval before borrower acceptance', () => {
    const s = run(start(), act('APPROVE'));
    expect(sunita(s).status).toBe('proposal_ready');
    expect(sunita(s).approval).toBeUndefined();
  });

  it('blocks application before approval', () => {
    const s = run(start(), act('ACCEPT'), act('APPLY_START'), act('APPLY_FINISH'));
    expect(sunita(s).status).toBe('accepted');
    expect(loan(s).version).toBe(1);
  });

  it('leaves the loan unchanged when the borrower declines', () => {
    const s = run(start(), act('DECLINE'), act('APPROVE'), act('APPLY_START'), act('APPLY_FINISH'));
    expect(sunita(s).status).toBe('declined');
    expect(loan(s).version).toBe(1);
    expect(run(s, act('REOPEN')).scenarios['heat:qualifying'].cases[S].status).toBe('proposal_ready');
  });

  it('leaves the loan unchanged when the approver rejects', () => {
    const s = run(start(), act('ACCEPT'), act('REJECT'), act('APPLY_START'), act('APPLY_FINISH'));
    expect(sunita(s).status).toBe('rejected');
    expect(loan(s).version).toBe(1);
  });
});

describe('duplicates', () => {
  it('ignores a repeated approval', () => {
    const s = run(approved(), act('APPROVE'), act('APPROVE'));
    expect(sunita(s).status).toBe('approved');
    expect(loan(s).version).toBe(1);
  });

  it('never applies a second benefit', () => {
    const s = run(applied(), act('APPROVE'), act('APPLY_START'), act('APPLY_FINISH'), act('REPEAT_REQUEST'));
    expect(sunita(s).status).toBe('applied');
    expect(loan(s).version).toBe(2);
    expect(loan(s).instalments.filter((i) => i.status === 'deferred')).toHaveLength(1);
    expect(remainingTotal(loan(s).instalments)).toBe(4500);
    expect(Object.keys(currentScenario(s).system.operations)).toHaveLength(1);
  });
});

describe('changed payment state', () => {
  it('invalidates a pending proposal when a payment is posted', () => {
    const s = run(approved(), act('POST_PAYMENT'));
    const c = sunita(s);
    expect(c.status).toBe('review_required');
    expect(c.proposal).toBeUndefined();
    expect(c.consent).toBeUndefined();
    expect(c.approval).toBeUndefined();
    expect(c.superseded).toHaveLength(1);
    expect(c.reviewReasons.join(' ')).toMatch(/payment was posted/);

    // The old approval cannot be used.
    const tried = run(s, act('APPLY_START'), act('APPLY_FINISH'));
    expect(sunita(tried).status).toBe('review_required');
    expect(loan(tried).instalments.some((i) => i.status === 'deferred')).toBe(false);
  });

  it('prepares a new proposal that needs fresh acceptance', () => {
    const s = run(approved(), act('POST_PAYMENT'), act('REEVALUATE'));
    const c = sunita(s);
    expect(c.status).toBe('proposal_ready');
    expect(c.proposal).toMatchObject({ originalDueDate: '2026-06-15', newDueDate: '2026-08-15', loanVersion: 2 });
    expect(c.proposal!.operationId).not.toBe(c.superseded[0]);
    expect(run(s, act('APPROVE')).scenarios['heat:qualifying'].cases[S].status).toBe('proposal_ready');
  });

  it('keeps arrears and prior relief in review after re-evaluation', () => {
    const s = run(start(), act('REEVALUATE', 'B03'), act('REEVALUATE', 'B04'));
    expect(currentScenario(s).cases.B03.status).toBe('review_required');
    expect(currentScenario(s).cases.B04.status).toBe('review_required');
  });
});

describe('failed and unknown application', () => {
  it('shows no change after a failure, then succeeds on retry with the same operation', () => {
    const failed = run(approved(), { type: 'SET_FAILURE_MODE', mode: 'fail' }, act('APPLY_START'), act('APPLY_FINISH'));
    expect(sunita(failed).status).toBe('failed');
    expect(loan(failed).version).toBe(1);
    expect(currentScenario(failed).system.collections.L01.demands[0].dueDate).toBe('2026-05-15');
    expect(currentScenario(failed).failureMode).toBe('none');

    const retried = run(failed, act('APPLY_START'), act('APPLY_FINISH'));
    expect(sunita(retried).status).toBe('applied');
    expect(sunita(retried).application!.attempts).toBe(2);
    expect(loan(retried).version).toBe(2);
    expect(Object.keys(currentScenario(retried).system.operations)).toEqual([sunita(retried).proposal!.operationId]);
  });

  it('resolves an unknown outcome by querying, without a new financial action', () => {
    const unknown = run(approved(), { type: 'SET_FAILURE_MODE', mode: 'unknown' }, act('APPLY_START'), act('APPLY_FINISH'));
    expect(sunita(unknown).status).toBe('unknown');
    // Nothing is shown as changed until the operation is checked.
    expect(knownNextDemand(currentScenario(unknown), S, 'L01')!.dueDate).toBe('2026-05-15');

    const checked = run(unknown, act('CHECK_STATUS'));
    expect(sunita(checked).status).toBe('applied');
    expect(loan(checked).version).toBe(2);
    expect(Object.keys(currentScenario(checked).system.operations)).toHaveLength(1);
    expect(remainingTotal(loan(checked).instalments)).toBe(4500);
  });

  it('restores an interrupted application as unknown and finds nothing committed', () => {
    const interrupted = run(approved(), act('APPLY_START'));
    const restored = rehydrate(JSON.parse(JSON.stringify(interrupted)), AT);
    expect(sunita(restored).status).toBe('unknown');
    const checked = run(restored, act('CHECK_STATUS'));
    expect(sunita(checked).status).toBe('failed');
    expect(loan(checked).version).toBe(1);
    expect(sunita(run(checked, act('APPLY_START'), act('APPLY_FINISH'))).status).toBe('applied');
  });
});

describe('evidence scenarios', () => {
  it('opens no proposal on missing evidence, a warning or an unmet rule', () => {
    const missing = run(start(), { type: 'SELECT_VARIANT', variant: 'missing' });
    expect(sunita(missing).status).toBe('review_required');
    expect(sunita(run(missing, act('ACCEPT'), act('APPROVE'))).status).toBe('review_required');
    expect(sunita(run(start(), { type: 'SELECT_VARIANT', variant: 'warning' })).status).toBe('warning_only');
    expect(sunita(run(start(), { type: 'SELECT_VARIANT', variant: 'threshold' })).status).toBe('rule_not_met');
  });

  it('leaves unaffected areas without a case', () => {
    const s = start();
    expect(currentScenario(s).cases.B16.status).toBe('not_affected');
    expect(currentScenario(run(s, act('ACCEPT', 'B16'), act('APPROVE', 'B16'))).cases.B16.status).toBe('not_affected');
  });
});

describe('scenario isolation', () => {
  it('does not carry cases, approvals or loan changes to another event', () => {
    const heat = applied();
    const flood = run(heat, { type: 'SELECT_HAZARD', hazard: 'flood' });
    expect(sunita(flood).status).toBe('not_affected');
    expect(loan(flood).version).toBe(1);
    expect(currentScenario(flood).activity).toHaveLength(1);

    const missing = run(heat, { type: 'SELECT_VARIANT', variant: 'missing' });
    expect(sunita(missing).status).toBe('review_required');
    expect(sunita(missing).approval).toBeUndefined();
    expect(loan(missing).version).toBe(1);

    // Returning to the first event finds its own state intact.
    const back = run(missing, { type: 'SELECT_VARIANT', variant: 'qualifying' });
    expect(sunita(back).status).toBe('applied');
  });

  it('applies an answer to the sandbox that sent it', () => {
    const sent = run(approved(), { type: 'APPLY_START', borrowerId: S, key: 'heat:qualifying' }, { type: 'SELECT_HAZARD', hazard: 'flood' });
    const done = run(sent, { type: 'APPLY_FINISH', borrowerId: S, key: 'heat:qualifying' });
    expect(done.scenarios['heat:qualifying'].cases[S].status).toBe('applied');
    expect(loan(done).version).toBe(1);
  });

  it('resets one scenario or everything', () => {
    const s = run(applied(), { type: 'RESET_SCENARIO' });
    expect(sunita(s).status).toBe('proposal_ready');
    expect(loan(s).version).toBe(1);
    expect(run(applied(), { type: 'SELECT_HAZARD', hazard: 'flood' }, { type: 'RESET_ALL' })).toEqual(start());
  });

  it('discards saved state from another schema version', () => {
    expect(rehydrate({ ...applied(), schemaVersion: 0 }, AT)).toEqual(start());
    expect(rehydrate('garbage', AT)).toEqual(start());
  });
});
