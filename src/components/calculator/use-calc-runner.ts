"use client";

import { useRef, useState, useTransition } from "react";
import type { CalcResult, CalcSuccess } from "@/lib/calc-types";

// Roda o cálculo no servidor só quando o formulário é enviado.
// `currentKey` é a entrada atual serializada: se mudar depois de calcular, o resultado fica desatualizado.
export function useCalcRunner<V>(
  run: (values: V) => Promise<CalcResult>,
  currentKey: string,
) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CalcSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calculatedKey, setCalculatedKey] = useState<string | null>(null);
  // Entrada enviada no último cálculo bem-sucedido.
  const [calculatedValues, setCalculatedValues] = useState<V | null>(null);
  const requestId = useRef(0);

  function submit(values: V) {
    const key = currentKey;
    const request = ++requestId.current;
    setError(null);
    startTransition(async () => {
      let response: CalcResult;
      try {
        response = await run(values);
      } catch {
        response = { ok: false, message: "Não foi possível calcular agora. Tente novamente." };
      }
      if (request !== requestId.current) return;
      if (response.ok) {
        setResult(response);
        setCalculatedKey(key);
        setCalculatedValues(values);
      } else {
        setError(response.message);
      }
    });
  }

  const stale = result !== null && currentKey !== calculatedKey;
  return { submit, pending, result, error, stale, calculatedValues };
}
