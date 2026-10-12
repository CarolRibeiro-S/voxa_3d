import { ArrowRight } from "lucide-react";

export interface ChangeItem {
  label: string;
  from: string;
  to: string;
  // Campos sensíveis (como senha) nunca mostram o valor.
  sensitive?: boolean;
}

const MAX_LINES = 8;
const SENSITIVE_LABEL = /senha|password|token|segredo/i;

function show(value: string): string {
  return value.trim() === "" ? "vazio" : value;
}

export function ChangesSummary({ changes }: { changes: ChangeItem[] }) {
  const visible = changes.slice(0, MAX_LINES);
  const extra = changes.length - visible.length;

  return (
    <div className="rounded-xl bg-nevoa p-3 text-sm">
      <ul className="space-y-2">
        {visible.map((change) => {
          const hidden = change.sensitive === true || SENSITIVE_LABEL.test(change.label);
          return (
            <li key={change.label}>
              <span className="font-medium">{change.label}:</span>{" "}
              {hidden ? (
                <span className="font-semibold">alterada</span>
              ) : (
                <>
                  <span className="break-words text-tinta/60 line-through">
                    {show(change.from)}
                  </span>{" "}
                  <ArrowRight size={14} className="inline align-text-bottom" aria-label="para" />{" "}
                  <span className="break-words font-semibold">{show(change.to)}</span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {extra > 0 && (
        <p className="mt-2 text-xs text-tinta/60">
          e mais {extra} {extra === 1 ? "alteração" : "alterações"}
        </p>
      )}
    </div>
  );
}
