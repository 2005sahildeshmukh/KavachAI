import { MessagePreview } from '../components/MessagePreview';
import { RELIEF_DISCLOSURE, ScheduleCompare, ScheduleList } from '../components/ScheduleCompare';
import { Card, CheckList, RoleGate, StatusBadge } from '../components/ui';
import { formatDate, inr } from '../domain/dates';
import { applyDeferral, remainingTotal } from '../domain/schedule';
import type { CaseStatus } from '../domain/types';
import { HAZARD_LABEL } from '../fixtures/evidence';
import { BORROWERS, areaName, borrowerById } from '../fixtures/portfolio';
import { knownNextDemand } from '../state/selectors';
import { useStore } from '../state/store';

const STEPS = ['Evidence', 'Proposal', 'Borrower acceptance', 'Lender approval', 'Mock loan system', 'Confirmed'];

/** Index of the step the case is waiting on. Steps before it are done. */
const STEP_AT: Partial<Record<CaseStatus, number>> = {
  proposal_ready: 2,
  accepted: 3,
  approved: 4,
  applying: 4,
  failed: 4,
  unknown: 4,
  applied: 6,
};

const EXPLAIN: Partial<Record<CaseStatus, string>> = {
  not_affected: 'This business is outside the area covered by the current evidence, so no case is opened. The loan is unchanged.',
  rule_not_met: 'The evidence does not meet the demo rule, so no support case is opened. The loan is unchanged.',
  warning_only: 'Only a warning exists. The borrower can be informed, but a warning never changes a loan. A proposal needs an observed event.',
  declined: 'The borrower declined. The loan schedule is unchanged and nothing is sent to the approver.',
  rejected: 'The approver rejected the change. The loan schedule is unchanged.',
  accepted: 'The borrower accepted. The change now waits for a lender approver. The official schedule has not changed.',
  approved: 'Approved, but approval is not the same as applied. The official schedule has not changed until the mock loan system confirms.',
  applying: 'Waiting for the mock loan system to answer.',
  failed: 'The application failed. The official schedule has not changed. The approver can retry with the same operation reference.',
  unknown: 'The outcome is not known. The existing operation must be checked before anything else is done. Until then, no revised dues or confirmation are shown.',
  applied: 'The mock loan system committed the change and the collection record matches it.',
};

export function BorrowerCase({ borrowerId }: { borrowerId: string }) {
  const { scenario, evidence, dispatch, navigate } = useStore();
  const borrower = borrowerById(borrowerId);
  const c = scenario.cases[borrowerId];
  if (!borrower || !c) {
    return (
      <Card title="Borrower not found">
        <button type="button" className="btn" onClick={() => navigate('overview')}>
          Back to overview
        </button>
      </Card>
    );
  }

  const loan = scenario.system.loans[borrower.loanId];
  const nextDemand = knownNextDemand(scenario, borrowerId, loan.id);
  const p = c.proposal;
  const applied = c.status === 'applied';
  const stepAt = STEP_AT[c.status];
  const canSimulatePayment = p && ['proposal_ready', 'accepted', 'approved', 'failed'].includes(c.status);
  const queueStatuses: CaseStatus[] = ['accepted', 'approved', 'applying', 'failed', 'unknown'];

  return (
    <>
      <div className="page-head">
        <label className="field inline">
          <span className="field-label">Borrower</span>
          <select value={borrowerId} onChange={(e) => navigate(`case/${e.target.value}`)}>
            {BORROWERS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {areaName(b.areaId)}
              </option>
            ))}
          </select>
        </label>
        <div className="case-title">
          <h1>{borrower.name}</h1>
          <StatusBadge status={c.status} />
        </div>
        <p>
          Fictional borrower · {borrower.business} · {areaName(borrower.areaId)} · {loan.product}
        </p>
      </div>

      {stepAt !== undefined && (
        <ol className="stepper" aria-label="Case progress">
          {STEPS.map((s, i) => {
            const state = i < stepAt ? 'done' : i === stepAt ? (c.status === 'failed' ? 'problem' : 'current') : 'todo';
            return (
              <li key={s} className={`step step-${state}`} aria-current={state === 'current' || state === 'problem' ? 'step' : undefined}>
                <span className="step-dot" aria-hidden="true">
                  {state === 'done' ? '✓' : state === 'problem' ? '✕' : i + 1}
                </span>
                <span>
                  {s}
                  <span className="sr-only">{state === 'done' ? ' (done)' : state === 'todo' ? ' (not started)' : state === 'problem' ? ' (failed)' : ' (current)'}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {EXPLAIN[c.status] && <p className={`notice notice-${c.status === 'failed' ? 'red' : applied ? 'green' : 'plain'}`}>{EXPLAIN[c.status]}</p>}

      {c.status === 'review_required' && (
        <Card title="Why this case needs review" className="card-amber">
          <ul className="reasons">
            {c.reviewReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="hint">Nothing is proposed automatically while a case is in review. The loan schedule is unchanged. A person decides the next step.</p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'REEVALUATE', borrowerId })}>
              Re-evaluate from the current loan record
            </button>
          </div>
        </Card>
      )}

      <div className="grid-2">
        <Card title={applied ? 'Schedule: original and revised' : p ? 'Schedule: current and proposed' : 'Current loan schedule'}>
          {p ? (
            <>
              <ScheduleCompare before={p.originalSchedule} after={applied ? loan.instalments : applyDeferral(p.originalSchedule, p.instalmentId, p.newDueDate)} applied={applied} />
              <p className="summary">
                {applied ? 'Moved' : 'Proposal: move'} the {inr(p.amount)} instalment from {formatDate(p.originalDueDate)} to {formatDate(p.newDueDate)}. Other dates stay
                the same. The payment is postponed, not forgiven.
              </p>
              <p className="disclosure">{RELIEF_DISCLOSURE}</p>
            </>
          ) : (
            <ScheduleList instalments={loan.instalments} />
          )}
          {!applied && nextDemand && (
            <p className="hint">
              Next demand last confirmed from the mock collection record: {inr(nextDemand.amount)} on {formatDate(nextDemand.dueDate)}.
            </p>
          )}
        </Card>

        <Card title="Support eligibility">
          <p className="hint">
            {HAZARD_LABEL[evidence.hazard]} evidence for {areaName(evidence.areaId)}.{' '}
            <button type="button" className="link" onClick={() => navigate('evidence')}>
              View evidence
            </button>
          </p>
          <CheckList checks={c.checks} />
        </Card>
      </div>

      {c.status === 'proposal_ready' && (
        <Card title="Borrower decision">
          <p>The borrower sees the exact terms above and can accept or decline. A lender cannot approve until the borrower accepts.</p>
          <RoleGate role="borrower">
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'ACCEPT', borrowerId })}>
                Accept the proposal
              </button>
              <button type="button" className="btn" onClick={() => dispatch({ type: 'DECLINE', borrowerId })}>
                Decline
              </button>
            </div>
          </RoleGate>
        </Card>
      )}

      {queueStatuses.includes(c.status) && (
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate('queue')}>
            Open the approval queue
          </button>
        </div>
      )}

      {c.status === 'declined' && (
        <div className="actions">
          <button type="button" className="btn" onClick={() => dispatch({ type: 'REOPEN', borrowerId })}>
            Offer the proposal again
          </button>
        </div>
      )}

      <Card title="Borrower message preview">
        <MessagePreview
          borrowerId={borrowerId}
          context={{
            name: borrower.name,
            area: areaName(borrower.areaId),
            hazard: evidence.hazard,
            status: c.status,
            nextAmount: nextDemand?.amount,
            nextDueDate: nextDemand?.dueDate,
            amount: p?.amount,
            fromDate: p?.originalDueDate,
            toDate: p?.newDueDate,
            total: remainingTotal(p?.originalSchedule ?? loan.instalments),
          }}
        />
      </Card>

      {canSimulatePayment && (
        <Card title="Demo control: payment during approval">
          <p>
            Post a payment of {inr(p.amount)} for the {formatDate(p.originalDueDate)} instalment directly in the mock loan system. The loan record changes, so the
            pending proposal stops being valid and returns for review.
          </p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => dispatch({ type: 'POST_PAYMENT', borrowerId })}>
              Simulate a posted payment
            </button>
          </div>
        </Card>
      )}

      <details className="tech">
        <summary>Record references</summary>
        <dl className="facts">
          <div>
            <dt>Loan</dt>
            <dd>
              {loan.id}, version {loan.version}
            </dd>
          </div>
          <div>
            <dt>Event</dt>
            <dd>{c.eventId}</dd>
          </div>
          <div>
            <dt>Operation reference</dt>
            <dd>{p ? p.operationId : 'None'}</dd>
          </div>
          {p && (
            <div>
              <dt>Proposal prepared against</dt>
              <dd>
                Loan version {p.loanVersion}, {p.policyVersion}
              </dd>
            </div>
          )}
          {c.superseded.length > 0 && (
            <div>
              <dt>Invalidated operations</dt>
              <dd>{c.superseded.join(', ')}</dd>
            </div>
          )}
        </dl>
      </details>
    </>
  );
}
