import type { FailureMode } from '../adapter/MockLoanSystemAdapter';
import type { Hazard, Variant } from '../domain/types';
import { HAZARDS, HAZARD_LABEL, HAZARD_TIMESCALE, variantsFor } from '../fixtures/evidence';
import { useStore } from '../state/store';
import { HazardIcon } from './ui';

export function FailureControl() {
  const { scenario, dispatch } = useStore();
  return (
    <div className="field">
      <label htmlFor="failure-mode">Simulate system failure</label>
      <select id="failure-mode" value={scenario.failureMode} onChange={(e) => dispatch({ type: 'SET_FAILURE_MODE', mode: e.target.value as FailureMode })}>
        <option value="none">Off: the mock loan system answers normally</option>
        <option value="fail">Next attempt fails before committing</option>
        <option value="unknown">Next attempt loses its response (outcome unknown)</option>
      </select>
      <p className="hint">Applies to the next application attempt only, then switches off.</p>
    </div>
  );
}

export function ScenarioControls() {
  const { state, scenario, dispatch } = useStore();
  return (
    <div className="controls">
      <div className="field">
        <span className="field-label" id="hazard-label">
          Hazard scenario
        </span>
        <div className="segmented" role="group" aria-labelledby="hazard-label">
          {HAZARDS.map((h: Hazard) => (
            <button key={h} type="button" aria-pressed={state.hazard === h} onClick={() => dispatch({ type: 'SELECT_HAZARD', hazard: h })}>
              <HazardIcon hazard={h} /> {HAZARD_LABEL[h]}
            </button>
          ))}
        </div>
        <p className="hint">{HAZARD_TIMESCALE[state.hazard]}</p>
      </div>

      <div className="field">
        <label htmlFor="variant">Sample evidence</label>
        <select id="variant" value={scenario.variant} onChange={(e) => dispatch({ type: 'SELECT_VARIANT', variant: e.target.value as Variant })}>
          {variantsFor(state.hazard).map((v) => (
            <option key={v.variant} value={v.variant}>
              {v.variantLabel}
            </option>
          ))}
        </select>
        <p className="hint">Each sample is a separate event with its own cases and mock loan records. Nothing carries over between them.</p>
      </div>

      <FailureControl />

      <div className="field field-end">
        <button type="button" className="btn" onClick={() => dispatch({ type: 'RESET_SCENARIO' })}>
          Reset this scenario
        </button>
      </div>
    </div>
  );
}
