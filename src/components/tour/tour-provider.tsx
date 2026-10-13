"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { can, type Role } from "@/lib/permissions";
import { hasFeature, type Plan } from "@/lib/plans";
import {
  TOURS,
  tourDisabledKey,
  tourForPath,
  tourKey,
  tourPrefix,
  type TourStep,
} from "@/lib/tours";
import { TourOverlay } from "./tour-overlay";

// Estado dos tutoriais no localStorage: só marcadores ("done", "skipped", "1"), nunca dados do
// negócio. Tudo com try/catch: sem localStorage a página continua funcionando.

const FIRST_DELAY_MS = 600;
const WAIT_FOR_TARGET_MS = 2000;
const POLL_MS = 100;

type Mark = "done" | "skipped";

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sem localStorage o tutorial só volta a aparecer na próxima visita.
  }
}
function removeItem(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignora.
  }
}

// A preferência "desativar tutoriais" é lida do localStorage sem causar diferença na hidratação:
// no servidor os tutoriais contam como ativados.
const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
const notifyListeners = () => listeners.forEach((listener) => listener());

// Elemento existe e está visível na tela.
function findVisible(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (el.getClientRects().length === 0) continue;
    const box = el.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return el;
  }
  return null;
}

interface ActiveTour {
  id: string;
  version: number;
  steps: TourStep[];
  index: number;
}

interface TourContextValue {
  enabled: boolean;
  hasTourHere: boolean;
  startTour: (id: string, options?: { force?: boolean }) => boolean;
  startCurrentPageTour: () => void;
  tryAutoStart: (id: string) => () => void;
  setEnabled: (enabled: boolean) => void;
  resetAll: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const value = useContext(TourContext);
  if (!value) throw new Error("useTour fora do TourProvider");
  return value;
}

// Inicia o tutorial automaticamente na primeira visita (veja src/lib/tours.ts).
export function useAutoTour(id: string) {
  const { tryAutoStart } = useTour();
  useEffect(() => tryAutoStart(id), [id, tryAutoStart]);
}

export function TourProvider({
  userId,
  plan,
  role,
  children,
}: {
  userId: string;
  plan: Plan;
  role: Role;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [active, setActive] = useState<ActiveTour | null>(null);
  const disabledKey = tourDisabledKey(userId);
  const disabled = useSyncExternalStore(
    subscribe,
    () => readItem(disabledKey) === "1",
    () => false,
  );
  const enabled = !disabled;
  const activeRef = useRef<ActiveTour | null>(null);
  const pageAutoStarted = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const commit = useCallback((next: ActiveTour | null) => {
    activeRef.current = next;
    setActive(next);
  }, []);

  // Trocou de página: encerra o tutorial atual sem marcar como concluído.
  useEffect(() => {
    pageAutoStarted.current = false;
    if (activeRef.current) {
      commit(null);
      returnFocus.current = null;
    }
  }, [pathname, commit]);

  const finish = useCallback(
    (mark: Mark | null) => {
      const current = activeRef.current;
      if (current && mark) writeItem(tourKey(userId, current.id, current.version), mark);
      commit(null);
      // Devolve o foco ao elemento que estava ativo antes do tutorial.
      const back = returnFocus.current;
      returnFocus.current = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    },
    [commit, userId],
  );

  const startTour = useCallback(
    (id: string, options?: { force?: boolean }) => {
      const def = TOURS[id];
      if (!def || activeRef.current) return false;
      if (def.requires && !hasFeature(plan, def.requires)) return false;
      // Quem não pode abrir a tela não recebe o tutorial dela.
      if (!can(role, def.capability)) return false;
      // Nunca começa com um diálogo de confirmação aberto.
      if (document.querySelector('dialog[open][role="alertdialog"]')) return false;

      if (!options?.force) {
        if (readItem(disabledKey) === "1") return false;
        if (readItem(tourKey(userId, def.id, def.version))) return false;
        // Um tutorial de página por visita. Os de ação (painel, formulário) são outra ação.
        if (def.kind === "page") {
          if (pageAutoStarted.current) return false;
        }
      }

      // Só entram os passos cujo alvo existe e está visível. No início automático o primeiro
      // alvo precisa existir.
      if (!options?.force && !findVisible(def.steps[0].target)) return false;
      const steps = def.steps.filter((s) => findVisible(s.target) !== null);
      if (steps.length === 0) return false;

      if (def.kind === "page" && !options?.force) pageAutoStarted.current = true;
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      commit({ id: def.id, version: def.version, steps, index: 0 });
      return true;
    },
    [commit, disabledKey, plan, role, userId],
  );

  const tryAutoStart = useCallback(
    (id: string) => {
      const def = TOURS[id];
      if (!def) return () => undefined;
      let poll: number | undefined;
      const first = window.setTimeout(() => {
        const startedAt = Date.now();
        const attempt = () => {
          if (findVisible(def.steps[0].target)) {
            startTour(id);
            return;
          }
          // Se o primeiro alvo não aparecer, não inicia e não marca como visto.
          if (Date.now() - startedAt < WAIT_FOR_TARGET_MS) poll = window.setTimeout(attempt, POLL_MS);
        };
        attempt();
      }, FIRST_DELAY_MS);

      return () => {
        window.clearTimeout(first);
        window.clearTimeout(poll);
        // Tutorial de painel ou formulário acaba junto com o painel, sem marcar como concluído.
        if (activeRef.current?.id === id && def.kind === "action") finish(null);
      };
    },
    [finish, startTour],
  );

  const startCurrentPageTour = useCallback(() => {
    const id = tourForPath(pathname);
    if (id) startTour(id, { force: true });
  }, [pathname, startTour]);

  const setEnabled = useCallback(
    (next: boolean) => {
      if (next) removeItem(disabledKey);
      else writeItem(disabledKey, "1");
      notifyListeners();
    },
    [disabledKey],
  );

  // "Refazer todos": apaga as marcas do usuário (a preferência de desativar fica como está).
  const resetAll = useCallback(() => {
    try {
      const prefix = tourPrefix(userId);
      const disabled = tourDisabledKey(userId);
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(prefix) && key !== disabled) keys.push(key);
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Ignora.
    }
  }, [userId]);

  // Navegação dentro do tutorial, pulando passos cujo alvo sumiu.
  const move = useCallback(
    (direction: 1 | -1) => {
      const current = activeRef.current;
      if (!current) return;
      let next = current.index + direction;
      while (next >= 0 && next < current.steps.length && !findVisible(current.steps[next].target)) {
        next += direction;
      }
      if (next >= current.steps.length) finish("done");
      else if (next >= 0) commit({ ...current, index: next });
    },
    [commit, finish],
  );

  const onNext = useCallback(() => move(1), [move]);
  const onBack = useCallback(() => move(-1), [move]);
  const onSkip = useCallback(() => finish("skipped"), [finish]);
  const onLost = useCallback(() => finish(null), [finish]);

  const hereId = tourForPath(pathname);
  const hasTourHere =
    hereId !== null && can(role, TOURS[hereId].capability) &&
    (!TOURS[hereId].requires || hasFeature(plan, TOURS[hereId].requires));
  const value = useMemo<TourContextValue>(
    () => ({ enabled, hasTourHere, startTour, startCurrentPageTour, tryAutoStart, setEnabled, resetAll }),
    [enabled, hasTourHere, startTour, startCurrentPageTour, tryAutoStart, setEnabled, resetAll],
  );

  const step = active ? active.steps[active.index] : null;
  const element = step ? findVisible(step.target) : null;

  // Se o alvo do passo atual sumiu antes de aparecer, segue para o próximo passo.
  const missingTarget = active !== null && step !== null && element === null;
  useEffect(() => {
    if (missingTarget) move(1);
  }, [missingTarget, active, move]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {active && step && element && (
        <TourOverlay
          key={`${active.id}-${active.index}`}
          step={step}
          element={element}
          index={active.index}
          total={active.steps.length}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
          onLost={onLost}
        />
      )}
    </TourContext.Provider>
  );
}

// Componente sem visual: coloca o tutorial automático numa página ou formulário.
export function AutoTour({ id }: { id: string }) {
  useAutoTour(id);
  return null;
}
