import { describe, expect, it } from 'vitest';
import { MockLoanSystemAdapter, collectionMatchesLoan, createLoanSystemState } from '../adapter/MockLoanSystemAdapter';
import { getEvidence } from '../fixtures/evidence';
import { BORROWERS, areaName, createLoans } from '../fixtures/portfolio';
import { SIM_DATE, addMonths, daysBetween } from './dates';
import { evaluateCase } from './eligibility';
import { buildMessage } from './messages';
import { evaluateEvidence } from './rules';
import { applyDeferral, compareSchedules, deferredDueDate, findTargetInstalment, remainingTotal } from './schedule';
import type { Evidence, Hazard, Variant } from './types';

const status = (h: Hazard, v: Variant) => evaluateEvidence(getEvidence(h, v), SIM_DATE).status;
const sunita = BORROWERS[0];
const sunitaLoan = () => createLoans()[0];

describe('dates', () => {
  it('adds months and clamps to the month end', () => {
    expect(addMonths('2026-07-15', 1)).toBe('2026-08-15');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(daysBetween('2026-05-12', '2026-05-15')).toBe(3);
  });
});

describe('heat rule', () => {
  it('qualifies on three complete days strictly above 40°C', () => {
    expect(status('heat', 'qualifying')).toBe('qualified');
  });

  it('fails when a day is exactly 40°C', () => {
    expect(status('heat', 'threshold')).toBe('not_met');
  });

  it('needs review when a day is missing', () => {
    expect(status('heat', 'missing')).toBe('review_required');
  });

  it('needs review when a day is not complete yet', () => {
    const base = getEvidence('heat', 'qualifying');
    const incomplete: Evidence = { ...base, readings: [{ date: '2026-05-10', maxC: 41 }, { date: '2026-05-11', maxC: 41 }, { date: '2026-05-12', maxC: 41 }] };
    expect(evaluateEvidence(incomplete, SIM_DATE).status).toBe('review_required');
  });

  it('needs review when the days are not consecutive', () => {
    const base = getEvidence('heat', 'qualifying');
    const gap: Evidence = { ...base, readings: [{ date: '2026-05-07', maxC: 41 }, { date: '2026-05-10', maxC: 41 }, { date: '2026-05-11', maxC: 41 }] };
    expect(evaluateEvidence(gap, SIM_DATE).status).toBe('review_required');
  });

  it('needs review when the evidence is stale', () => {
    expect(evaluateEvidence(getEvidence('heat', 'qualifying'), '2026-05-20').status).toBe('review_required');
  });

  it('keeps a forecast at warning', () => {
    expect(status('heat', 'warning')).toBe('warning');
  });
});

describe('flood and drought rules', () => {
  it('qualifies an observed inundation record for the area', () => {
    expect(status('flood', 'qualifying')).toBe('qualified');
  });

  it('keeps a rainfall warning at warning', () => {
    expect(status('flood', 'warning')).toBe('warning');
  });

  it('sends an unconfirmed flood area to review', () => {
    expect(status('flood', 'missing')).toBe('review_required');
  });

  it('qualifies a drought assessment over a completed period', () => {
    expect(status('drought', 'qualifying')).toBe('qualified');
  });

  it('keeps an in-season drought outlook at warning', () => {
    expect(status('drought', 'warning')).toBe('warning');
  });

  it('sends an unfinished drought reference period to review', () => {
    expect(status('drought', 'missing')).toBe('review_required');
  });
});

describe('schedule', () => {
  it('matches the worked example for Sunita', () => {
    const loan = sunitaLoan();
    const unpaid = loan.instalments.filter((i) => i.status === 'unpaid');
    expect(unpaid.map((i) => [i.dueDate, i.amount])).toEqual([
      ['2026-05-15', 1500],
      ['2026-06-15', 1500],
      ['2026-07-15', 1500],
    ]);

    const target = findTargetInstalment(loan, SIM_DATE)!;
    expect(target.dueDate).toBe('2026-05-15');
    expect(deferredDueDate(loan.instalments)).toBe('2026-08-15');

    const revised = applyDeferral(loan.instalments, target.id, '2026-08-15');
    expect(remainingTotal(loan.instalments)).toBe(4500);
    expect(remainingTotal(revised)).toBe(4500);
    expect(compareSchedules(loan.instalments, revised)).toEqual([
      { dueDate: '2026-05-15', before: 1500, after: 0, note: 'Deferred' },
      { dueDate: '2026-06-15', before: 1500, after: 1500, note: undefined },
      { dueDate: '2026-07-15', before: 1500, after: 1500, note: undefined },
      { dueDate: '2026-08-15', before: null, after: 1500, note: 'Moved here' },
    ]);
  });

  it('does not treat an instalment due on the simulation date as not yet due', () => {
    const loan = sunitaLoan();
    expect(findTargetInstalment(loan, '2026-05-15')!.dueDate).toBe('2026-06-15');
  });

  it('refuses to defer a paid instalment', () => {
    expect(() => applyDeferral(sunitaLoan().instalments, 'I1', '2026-08-15')).toThrow();
  });
});

describe('eligibility', () => {
  const evidence = getEvidence('heat', 'qualifying');
  const evaluation = evaluateEvidence(evidence, SIM_DATE);
  const loans = createLoans();
  const evalFor = (name: string) => {
    const b = BORROWERS.find((x) => x.name === name)!;
    return evaluateCase(b, loans.find((l) => l.id === b.loanId)!, evidence, evaluation, areaName(b.areaId), SIM_DATE);
  };

  it('has twenty borrowers', () => {
    expect(BORROWERS).toHaveLength(20);
  });

  it('prepares a proposal with a stable operation ID', () => {
    const a = evalFor('Sunita');
    const b = evalFor('Sunita');
    expect(a.status).toBe('proposal_ready');
    expect(a.proposal!.operationId).toBe(b.proposal!.operationId);
    expect(a.proposal!.newDueDate).toBe('2026-08-15');
  });

  it('sends arrears and prior relief to review with reasons', () => {
    expect(evalFor('Rekha').status).toBe('review_required');
    expect(evalFor('Rekha').reviewReasons.join(' ')).toMatch(/arrears/);
    expect(evalFor('Meena').status).toBe('review_required');
    expect(evalFor('Meena').reviewReasons.join(' ')).toMatch(/already received relief/);
  });

  it('leaves borrowers outside the area unaffected', () => {
    expect(evalFor('Farida').status).toBe('not_affected');
    expect(evalFor('Mamta').status).toBe('not_affected');
  });

  it('never proposes on a warning or on incomplete evidence', () => {
    const run = (v: Variant) => {
      const e = getEvidence('heat', v);
      return evaluateCase(sunita, sunitaLoan(), e, evaluateEvidence(e, SIM_DATE), 'Suryagarh block', SIM_DATE);
    };
    expect(run('warning').status).toBe('warning_only');
    expect(run('missing').status).toBe('review_required');
    expect(run('threshold').status).toBe('rule_not_met');
    expect(run('warning').proposal).toBeUndefined();
    expect(run('missing').proposal).toBeUndefined();
  });

  it('sends an unsupported product and a non-enrolled borrower to review', () => {
    const run = (name: string, h: Hazard) => {
      const b = BORROWERS.find((x) => x.name === name)!;
      const e = getEvidence(h, 'qualifying');
      return evaluateCase(b, loans.find((l) => l.id === b.loanId)!, e, evaluateEvidence(e, SIM_DATE), areaName(b.areaId), SIM_DATE);
    };
    expect(run('Shabnam', 'flood').status).toBe('review_required');
    expect(run('Asha', 'drought').status).toBe('review_required');
  });
});

describe('mock loan system adapter', () => {
  const request = { operationId: 'OP-1', eventId: 'HEAT-Q', loanId: 'L01', expectedVersion: 1, instalmentId: 'I3', newDueDate: '2026-08-15' };
  const fresh = () => {
    const state = createLoanSystemState(createLoans());
    return { state, adapter: new MockLoanSystemAdapter(state) };
  };

  it('commits once and updates the collection record with it', () => {
    const { adapter } = fresh();
    const result = adapter.applyRelief(request);
    expect(result.kind).toBe('committed');
    const loan = adapter.getLoan('L01')!;
    expect(loan.version).toBe(2);
    expect(collectionMatchesLoan(loan, adapter.getCollection('L01'))).toBe(true);
    expect(adapter.getCollection('L01')!.demands[0]).toMatchObject({ dueDate: '2026-06-15', amount: 1500 });
  });

  it('returns the existing result for a repeated operation ID', () => {
    const { adapter } = fresh();
    adapter.applyRelief(request);
    const again = adapter.applyRelief(request);
    expect(again).toMatchObject({ kind: 'committed', duplicate: true });
    expect(adapter.getLoan('L01')!.version).toBe(2);
    expect(remainingTotal(adapter.getLoan('L01')!.instalments)).toBe(4500);
  });

  it('refuses a second benefit for the same event under a new operation ID', () => {
    const { adapter } = fresh();
    adapter.applyRelief(request);
    const second = adapter.applyRelief({ ...request, operationId: 'OP-2', expectedVersion: 2, instalmentId: 'I4' });
    expect(second).toMatchObject({ kind: 'rejected', code: 'RELIEF_ALREADY_APPLIED' });
  });

  it('rejects a stale loan version after a payment', () => {
    const { adapter } = fresh();
    adapter.postPayment('L01', 'I3');
    expect(adapter.applyRelief(request)).toMatchObject({ kind: 'rejected', code: 'STALE_VERSION' });
    expect(adapter.applyRelief({ ...request, expectedVersion: 2 })).toMatchObject({ kind: 'rejected', code: 'INSTALMENT_NOT_UNPAID' });
  });

  it('changes nothing on a failure', () => {
    const { adapter, state } = fresh();
    const before = JSON.stringify(state);
    expect(adapter.applyRelief(request, 'fail').kind).toBe('failed');
    expect(JSON.stringify(state)).toBe(before);
    expect(adapter.getOperationStatus('OP-1')).toBeUndefined();
  });

  it('lets an unknown outcome be resolved by a status query', () => {
    const { adapter } = fresh();
    expect(adapter.applyRelief(request, 'unknown').kind).toBe('unknown');
    expect(adapter.getOperationStatus('OP-1')).toMatchObject({ committedVersion: 2 });
    expect(adapter.applyRelief(request)).toMatchObject({ kind: 'committed', duplicate: true });
    expect(adapter.getLoan('L01')!.version).toBe(2);
  });

  it('previews without changing the loan', () => {
    const { adapter } = fresh();
    const preview = adapter.previewRelief('L01', 'I3', '2026-08-15');
    expect(remainingTotal(preview)).toBe(4500);
    expect(adapter.getLoan('L01')!.version).toBe(1);
  });
});

describe('borrower messages', () => {
  const ctx = { name: 'Sunita', area: 'Suryagarh block', hazard: 'heat' as const, nextAmount: 1500, nextDueDate: '2026-05-15', amount: 1500, fromDate: '2026-05-15', toDate: '2026-08-15', total: 4500 };

  it('only describes the change as done once applied', () => {
    expect(buildMessage('en', { ...ctx, status: 'approved' })).toMatch(/not confirmed yet/);
    expect(buildMessage('en', { ...ctx, status: 'failed' })).toMatch(/have not changed/);
    expect(buildMessage('en', { ...ctx, status: 'applied', nextDueDate: '2026-06-15' })).toMatch(/pay nothing on 15 May 2026/);
  });

  it('has a Hindi version with the same figures', () => {
    const hi = buildMessage('hi', { ...ctx, status: 'proposal_ready' });
    expect(hi).toContain('₹1,500');
    expect(hi).toContain('15 अगस्त 2026');
    expect(hi).toContain('₹4,500');
  });
});
