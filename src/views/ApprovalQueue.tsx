import { FailureControl } from '../components/ScenarioControls';
import { RELIEF_DISCLOSURE } from '../components/ScheduleCompare';
import { Card, RoleGate, StatusBadge } from '../components/ui';
import { formatDate, inr } from '../domain/dates';
import type { CaseStatus, SupportCase } from '../domain/types';
import { areaName, borrowerById } from '../fixtures/portfolio';
import { useStore } from '../state/store';

const GROUPS: { title: string; empty: string; statuses: CaseStatus[] }[] = [
  { title: 'Needs lender action', empty: 'Nothing is waiting for the approver. A case arrives here after the borrower accepts.', statuses: ['accepted', 'approved', 'applying', 'failed', 'unknown'] },
  { title: 'Waiting for the borrower', empty: 'No proposal is waiting for a borrower answer.', statuses: ['proposal_ready'] },
  { title: 'In review', empty: 'No case is in review.', statuses: ['review_required'] },
  { title: 'Closed', empty: 'No case is closed yet.', statuses: ['applied', 'declined', 'rejected'] },
];

function acceptanceText(c: SupportCase): string {
  if (c.status === 'proposal_ready') return 'Not answered yet';
  if (c.status === 'declined') return 'Declined';
  if (c.status === 'review_required') return c.superseded.length > 0 ? 'Earlier acceptance no longer valid' : 'Not requested';
  return c.consent?.decision === 'accepted' ? 'Accepted' : 'None';
}

function QueueItem({ c }: { c: SupportCase }) {
  const { dispatch, apply, navigate } = useStore();
  const b = borrowerById(c.borrowerId)!;
  const p = c.proposal;
  const id = c.borrowerId;

  return (
    <li className="queue-item">
      <div className="queue-head">
        <div>
          <button type="button" className="link queue-name" onClick={() => navigate(`case/${id}`)}>
            {b.name}
          </button>
          <span className="hint">
            {' '}
            · {b.business} · {areaName(b.areaId)}
          </span>
        </div>
        <StatusBadge status={c.status} />
      </div>

      <dl className="facts">
        <div>
          <dt>Proposed change</dt>
          <dd>{p ? `Move ${inr(p.amount)} from ${formatDate(p.originalDueDate)} to ${formatDate(p.newDueDate)}. Total unchanged.` : 'No current proposal'}</dd>
        </div>
        <div>
          <dt>Borrower acceptance</dt>
          <dd>{acceptanceText(c)}</dd>
        </div>
        <div>
          <dt>Mock loan system</dt>
          <dd>{c.status === 'applied' ? 'Committed. Collection record matches.' : c.application ? c.application.lastMessage : 'No application sent'}</dd>
        </div>
      </dl>

      {c.status === 'review_required' && <p className="hint">{c.reviewReasons.join(' ')}</p>}

      {c.status === 'accepted' && (
        <RoleGate role="approver">
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'APPROVE', borrowerId: id })}>
              Approve
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'REJECT', borrowerId: id })}>
              Reject
            </button>
          </div>
        </RoleGate>
      )}

      {(c.status === 'approved' || c.status === 'failed') && (
        <RoleGate role="approver">
          {c.status === 'failed' && (
            <p className="notice notice-red" role="alert">
              <span aria-hidden="true">✕ </span>Application failed. The official schedule is unchanged. A retry reuses the same operation reference.
            </p>
          )}
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => apply(id)}>
              {c.status === 'failed' ? 'Retry application' : 'Apply to the mock loan system'}
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: 'APPROVE', borrowerId: id })}>
              Approve again (duplicate test)
            </button>
          </div>
        </RoleGate>
      )}

      {c.status === 'applying' && (
        <p className="notice notice-plain" role="status">
          <span className="spinner" aria-hidden="true" /> Waiting for the mock loan system. Nothing is confirmed yet.
        </p>
      )}

      {c.status === 'unknown' && (
        <>
          <p className="notice notice-amber" role="alert">
            <span aria-hidden="true">! </span>No answer came back, so the outcome is not known. Check the existing operation. Do not send a new request.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'CHECK_STATUS', borrowerId: id })}>
              Check operation status
            </button>
          </div>
        </>
      )}

      {c.status === 'applied' && (
        <>
          <p className="notice notice-green" role="status">
            <span aria-hidden="true">✓ </span>Confirmed. The mock loan system committed the change and the collection record matches.
          </p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => dispatch({ type: 'REPEAT_REQUEST', borrowerId: id })}>
              Send the same request again (duplicate test)
            </button>
            <button type="button" className="btn" onClick={() => navigate('history')}>
              View in activity history
            </button>
          </div>
        </>
      )}

      {p && <p className="ref">Operation reference: {p.operationId}</p>}
    </li>
  );
}

export function ApprovalQueue() {
  const { scenario } = useStore();
  const cases = Object.values(scenario.cases);

  return (
    <>
      <div className="page-head">
        <h1>Approval queue</h1>
        <p>
          Borrower acceptance comes first, then lender approval, then application to the mock loan system. Success is shown only after the mock system commits
          and the collection record matches.
        </p>
      </div>

      <Card title="Demo control">
        <FailureControl />
        <p className="disclosure">{RELIEF_DISCLOSURE}</p>
      </Card>

      {GROUPS.map((g) => {
        const items = cases.filter((c) => g.statuses.includes(c.status));
        return (
          <Card key={g.title} title={`${g.title} (${items.length})`}>
            {items.length === 0 ? (
              <p className="hint">{g.empty}</p>
            ) : (
              <ul className="queue">
                {items.map((c) => (
                  <QueueItem key={c.borrowerId} c={c} />
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </>
  );
}
