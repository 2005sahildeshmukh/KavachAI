import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { SIM_DATE } from '../domain/dates';
import { evaluateEvidence } from '../domain/rules';
import type { Evidence, EvidenceEvaluation } from '../domain/types';
import { getEvidence } from '../fixtures/evidence';
import { currentScenario, reducer, rehydrate, scenarioKey, type Action, type AppState, type ScenarioState } from './reducer';

const STORAGE_KEY = 'kavach-demo-state';
/** How long the mock loan system "takes" to answer, so the applying state is visible. */
const MOCK_LATENCY_MS = 900;

function load(): AppState {
  let saved: unknown = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    // Unreadable or blocked storage: start from the fixtures.
  }
  return rehydrate(saved, new Date().toISOString());
}

export interface Route {
  view: 'overview' | 'evidence' | 'case' | 'queue' | 'history';
  borrowerId?: string;
}

function parseHash(): Route {
  const [view, id] = window.location.hash.replace(/^#\/?/, '').split('/');
  if (view === 'evidence' || view === 'queue' || view === 'history') return { view };
  if (view === 'case' && id) return { view, borrowerId: id };
  return { view: 'overview' };
}

interface Store {
  state: AppState;
  scenario: ScenarioState;
  evidence: Evidence;
  evaluation: EvidenceEvaluation;
  route: Route;
  dispatch: (action: Action) => void;
  /** Sends an approved change to the mock loan system and waits for its answer. */
  apply: (borrowerId: string) => void;
  navigate: (path: string) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, load);
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Only synthetic demo state is stored, and only in this browser.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable: the demo still works for this page visit.
    }
  }, [state]);

  const dispatch = useCallback((action: Action) => rawDispatch({ ...action, at: new Date().toISOString() }), []);

  const stateRef = useRef(state);
  stateRef.current = state;

  const apply = useCallback(
    (borrowerId: string) => {
      // Pin the sandbox, so the answer lands on the right event even if the screen changes.
      const { hazard, variants } = stateRef.current;
      const key = scenarioKey(hazard, variants[hazard]);
      dispatch({ type: 'APPLY_START', borrowerId, key });
      window.setTimeout(() => dispatch({ type: 'APPLY_FINISH', borrowerId, key }), MOCK_LATENCY_MS);
    },
    [dispatch],
  );

  const navigate = useCallback((path: string) => {
    window.location.hash = `#/${path}`;
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo<Store>(() => {
    const scenario = currentScenario(state);
    const evidence = getEvidence(scenario.hazard, scenario.variant);
    return { state, scenario, evidence, evaluation: evaluateEvidence(evidence, SIM_DATE), route, dispatch, apply, navigate };
  }, [state, route, dispatch, apply, navigate]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}
