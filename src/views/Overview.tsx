import { ScenarioControls } from '../components/ScenarioControls';
import { Badge, Card, EVENT_STATUS, FixtureTag, StatusBadge } from '../components/ui';
import { formatDate, inr } from '../domain/dates';
import type { CaseStatus } from '../domain/types';
import { HAZARD_LABEL } from '../fixtures/evidence';
import { BORROWERS, areaName } from '../fixtures/portfolio';
import { knownNextDemand } from '../state/selectors';
import { useStore } from '../state/store';

export function Overview() {
  const { scenario, evidence, evaluation, navigate } = useStore();
  const cases = Object.values(scenario.cases);
  const count = (...statuses: CaseStatus[]) => cases.filter((c) => statuses.includes(c.status)).length;

  // Every figure is counted from the current demo state. None is a measured outcome.
  const stats = [
    { label: 'Borrowers in portfolio', value: BORROWERS.length },
    { label: 'In the evidence area', value: cases.filter((c) => c.status !== 'not_affected').length },
    { label: 'Awaiting borrower', value: count('proposal_ready') },
    { label: 'Awaiting lender', value: count('accepted', 'approved', 'applying') },
    { label: 'In review', value: count('review_required') },
    { label: 'Failed or unknown', value: count('failed', 'unknown') },
    { label: 'Applied and confirmed', value: count('applied') },
  ];
  const eventMeta = EVENT_STATUS[evaluation.status];

  return (
    <>
      <div className="page-head">
        <h1>Portfolio overview</h1>
        <p>Twenty fictional borrowers in four fictional service areas. Choose a hazard scenario, then open a borrower to follow the case.</p>
      </div>

      <Card title="Scenario">
        <ScenarioControls />
      </Card>

      <Card
        title={`${HAZARD_LABEL[scenario.hazard]} evidence · ${areaName(evidence.areaId)}`}
        aside={<FixtureTag />}
      >
        <div className="event-row">
          <Badge tone={eventMeta.tone}>{eventMeta.label}</Badge>
          <p>{evaluation.headline}</p>
          <button type="button" className="btn" onClick={() => navigate('evidence')}>
            View evidence and rule
          </button>
        </div>
      </Card>

      <ul className="stats" aria-label="Counts from the current demo state">
        {stats.map((s) => (
          <li key={s.label}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </li>
        ))}
      </ul>

      <Card title="Borrowers" aside={<span className="hint">Select a borrower to open the case</span>}>
        <div className="table-wrap">
          <table className="table portfolio">
            <thead>
              <tr>
                <th scope="col">Borrower</th>
                <th scope="col">Business</th>
                <th scope="col">Area</th>
                <th scope="col">Next instalment</th>
                <th scope="col">Case status</th>
              </tr>
            </thead>
            <tbody>
              {BORROWERS.map((b) => {
                const next = knownNextDemand(scenario, b.id, b.loanId);
                return (
                  <tr key={b.id} className="row-link" onClick={() => navigate(`case/${b.id}`)}>
                    <th scope="row" data-label="Borrower">
                      <button type="button" className="link" onClick={(e) => { e.stopPropagation(); navigate(`case/${b.id}`); }}>
                        {b.name}
                      </button>
                    </th>
                    <td data-label="Business">{b.business}</td>
                    <td data-label="Area">{areaName(b.areaId)}</td>
                    <td data-label="Next instalment">{next ? `${inr(next.amount)} on ${formatDate(next.dueDate)}` : 'None'}</td>
                    <td data-label="Case status">
                      <StatusBadge status={scenario.cases[b.id].status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
