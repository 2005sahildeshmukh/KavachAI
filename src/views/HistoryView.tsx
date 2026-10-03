import { useState } from 'react';
import { ScheduleCompare } from '../components/ScheduleCompare';
import { Card, ROLE_LABEL } from '../components/ui';
import type { ActivityKind } from '../domain/types';
import { HAZARD_LABEL } from '../fixtures/evidence';
import { borrowerById } from '../fixtures/portfolio';
import { useStore } from '../state/store';

const KIND_LABEL: Record<ActivityKind, string> = {
  event: 'Climate event',
  message: 'Message preview',
  acceptance: 'Borrower answer',
  approval: 'Approval',
  loan_change: 'Loan change',
  collection: 'Collection update',
  review: 'Review',
  system: 'System',
};

const FILTERS: ('all' | ActivityKind)[] = ['all', 'event', 'acceptance', 'approval', 'loan_change', 'collection', 'review', 'message'];

export function HistoryView() {
  const { scenario, evidence } = useStore();
  const [filter, setFilter] = useState<'all' | ActivityKind>('all');
  const entries = [...scenario.activity].reverse().filter((e) => filter === 'all' || e.kind === filter);
  const appliedCases = Object.values(scenario.cases).filter((c) => c.status === 'applied' && c.proposal);

  return (
    <>
      <div className="page-head">
        <h1>Activity history</h1>
        <p>
          Everything recorded for the current scenario ({HAZARD_LABEL[scenario.hazard]}, {evidence.variantLabel.toLowerCase()}), newest first. Times are from your
          browser clock. The simulation date stays fixed.
        </p>
      </div>

      <Card title="Entries">
        <div className="chips" role="group" aria-label="Filter entries by type">
          {FILTERS.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : KIND_LABEL[f]}
            </button>
          ))}
        </div>
        {entries.length === 0 ? (
          <p className="hint">No entries of this type yet.</p>
        ) : (
          <ol className="timeline">
            {entries.map((e) => (
              <li key={e.id} className={`tl tl-${e.kind}`}>
                <div className="tl-meta">
                  <span className="tl-kind">{KIND_LABEL[e.kind]}</span>
                  <time dateTime={e.at}>{new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
                  <span>{e.actor === 'system' ? 'System' : `${ROLE_LABEL[e.actor]} (demo role)`}</span>
                </div>
                <strong>{e.title}</strong>
                <p>{e.detail}</p>
                {e.operationId && <p className="ref">Operation reference: {e.operationId}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Retained schedules">
        {appliedCases.length === 0 ? (
          <p className="hint">When a change is applied, the original and revised schedules are kept here side by side.</p>
        ) : (
          appliedCases.map((c) => (
            <div key={c.borrowerId} className="retained">
              <h3>{borrowerById(c.borrowerId)?.name}</h3>
              <ScheduleCompare before={c.proposal!.originalSchedule} after={scenario.system.loans[c.proposal!.loanId].instalments} applied />
              <p className="ref">Operation reference: {c.proposal!.operationId}</p>
            </div>
          ))
        )}
      </Card>
    </>
  );
}
