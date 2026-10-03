import { Badge, Card, CheckList, EVENT_STATUS, FixtureTag } from '../components/ui';
import { SIM_DATE, formatDate } from '../domain/dates';
import { HEAT_THRESHOLD_C } from '../domain/rules';
import { HAZARD_LABEL, HAZARD_TIMESCALE, variantsFor } from '../fixtures/evidence';
import { areaName } from '../fixtures/portfolio';
import { useStore } from '../state/store';

export function EvidenceView() {
  const { scenario, evidence, evaluation, dispatch, navigate } = useStore();
  const meta = EVENT_STATUS[evaluation.status];
  const observed = evidence.kind === 'observed';
  const affected = Object.values(scenario.cases).filter((c) => c.status !== 'not_affected');

  return (
    <>
      <div className="page-head">
        <h1>Climate evidence</h1>
        <p>
          What the sample record says, how old it is, and how the demo rule reads it. A warning can inform borrowers. Only an observed event can open a
          repayment proposal, and neither changes a loan by itself.
        </p>
      </div>

      <Card title={evidence.title} aside={<FixtureTag />}>
        <div className="event-row">
          <Badge tone={observed ? 'teal' : 'amber'}>{observed ? 'Observed event record' : 'Warning (forecast or outlook)'}</Badge>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>
        <dl className="facts">
          <div>
            <dt>Hazard</dt>
            <dd>{HAZARD_LABEL[evidence.hazard]}</dd>
          </div>
          <div>
            <dt>Area</dt>
            <dd>{areaName(evidence.areaId)} (fictional){!evidence.areaConfirmed && ', not confirmed by the record'}</dd>
          </div>
          <div>
            <dt>Source type</dt>
            <dd>{evidence.sourceType}, synthetic sample</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{formatDate(evidence.issuedAt)}</dd>
          </div>
          <div>
            <dt>{observed ? 'Observation period' : 'Forecast period'}</dt>
            <dd>
              {formatDate(evidence.periodStart)} to {formatDate(evidence.periodEnd)}
              <br />
              <span className="hint">{evidence.periodLabel}</span>
            </dd>
          </div>
          <div>
            <dt>Freshness</dt>
            <dd>
              {evaluation.ageDays} day{evaluation.ageDays === 1 ? '' : 's'} old on {formatDate(SIM_DATE)}
              <br />
              <span className="hint">Limit for this hazard: {evidence.maxAgeDays} days</span>
            </dd>
          </div>
        </dl>
        <p>{evidence.detail}</p>

        {evidence.readings && (
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Daily maximum temperature readings</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className="num">
                    Daily maximum
                  </th>
                  <th scope="col">Against {HEAT_THRESHOLD_C}°C</th>
                </tr>
              </thead>
              <tbody>
                {evidence.readings.map((r) => (
                  <tr key={r.date}>
                    <th scope="row">{formatDate(r.date)}</th>
                    <td className="num">{r.maxC === null ? 'Missing' : `${r.maxC.toFixed(1)}°C`}</td>
                    <td>{r.maxC === null ? 'Cannot be checked' : r.maxC > HEAT_THRESHOLD_C ? 'Above' : 'Not above'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="How the rule reads this evidence">
        <p className="rule-text">{evaluation.rule}</p>
        <CheckList checks={evaluation.steps} />
        <p className="outcome">
          <strong>Result:</strong> {evaluation.headline}
        </p>
        <p className="hint">Timescale: {HAZARD_TIMESCALE[evidence.hazard]}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate('overview')}>
            See the {affected.length} borrowers in this area
          </button>
        </div>
      </Card>

      <Card title={`Other ${HAZARD_LABEL[evidence.hazard].toLowerCase()} samples`}>
        <p className="hint">Each sample is a separate event. Switching does not carry any case, acceptance or approval across.</p>
        <div className="actions">
          {variantsFor(evidence.hazard).map((v) => (
            <button key={v.id} type="button" className="btn" aria-pressed={v.variant === evidence.variant} onClick={() => dispatch({ type: 'SELECT_VARIANT', variant: v.variant })}>
              {v.variantLabel}
            </button>
          ))}
        </div>
      </Card>
    </>
  );
}
