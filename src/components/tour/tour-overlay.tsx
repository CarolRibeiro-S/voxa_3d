"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type { TourStep } from "@/lib/tours";

// Tela escurecida com recorte no elemento importante e um cartão explicando. É feito sem
// biblioteca porque os formulários abrem em <dialog> modal, que fica na camada de cima do
// navegador: uma sobreposição colocada no <body> ficaria por baixo. Aqui a sobreposição é criada
// dentro do <dialog> quando o elemento está dentro dele.

const PAD = 6;
const GAP = 14;
const MARGIN = 12;
const MOBILE_WIDTH = 640;

interface TourOverlayProps {
  step: TourStep;
  element: HTMLElement;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  // O elemento destacado saiu da tela (por exemplo, o painel fechou).
  onLost: () => void;
}

const sameRect = (a: DOMRect | null, b: DOMRect) =>
  a !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Traz o elemento para a tela. No celular reserva o espaço do cartão que fica embaixo.
function scrollToTarget(element: HTMLElement, sheetHeight: number) {
  const previousBottom = element.style.scrollMarginBottom;
  const previousTop = element.style.scrollMarginTop;
  element.style.scrollMarginBottom = `${sheetHeight + 24}px`;
  element.style.scrollMarginTop = "24px";
  element.scrollIntoView({
    block: sheetHeight > 0 ? "nearest" : "center",
    inline: "nearest",
    behavior: reducedMotion() ? "auto" : "smooth",
  });
  element.style.scrollMarginBottom = previousBottom;
  element.style.scrollMarginTop = previousTop;
}

export function TourOverlay({
  step,
  element,
  index,
  total,
  onNext,
  onBack,
  onSkip,
  onLost,
}: TourOverlayProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mobile, setMobile] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const titleId = useId();
  const textId = useId();
  const isFirst = index === 0;
  const isLast = index === total - 1;

  // Acompanha a posição do elemento (rolagem, redimensionamento, mudanças de layout).
  useEffect(() => {
    const update = () => {
      if (!element.isConnected) {
        onLost();
        return;
      }
      const next = element.getBoundingClientRect();
      setRect((current) => (sameRect(current, next) ? current : next));
      setMobile(window.innerWidth < MOBILE_WIDTH);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const interval = window.setInterval(update, 300);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [element, onLost]);

  // Rola até o elemento a cada passo.
  useLayoutEffect(() => {
    const sheet = window.innerWidth < MOBILE_WIDTH ? (cardRef.current?.offsetHeight ?? 0) : 0;
    scrollToTarget(element, sheet);
  }, [element, index]);

  // Posiciona o cartão ao lado do destaque, trocando de lado se não couber.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !rect || mobile) return;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const box = {
      top: rect.top - PAD,
      left: rect.left - PAD,
      right: rect.right + PAD,
      bottom: rect.bottom + PAD,
    };
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
    const centerLeft = clamp((box.left + box.right) / 2 - cw / 2, MARGIN, vw - cw - MARGIN);
    const centerTop = clamp((box.top + box.bottom) / 2 - ch / 2, MARGIN, vh - ch - MARGIN);

    const place = {
      bottom: { top: box.bottom + GAP, left: centerLeft, fits: box.bottom + GAP + ch <= vh - MARGIN },
      top: { top: box.top - GAP - ch, left: centerLeft, fits: box.top - GAP - ch >= MARGIN },
      right: { top: centerTop, left: box.right + GAP, fits: box.right + GAP + cw <= vw - MARGIN },
      left: { top: centerTop, left: box.left - GAP - cw, fits: box.left - GAP - cw >= MARGIN },
    };
    const order: (keyof typeof place)[] = [
      step.side,
      step.side === "top" ? "bottom" : step.side === "bottom" ? "top" : step.side === "left" ? "right" : "left",
      "bottom",
      "top",
      "right",
      "left",
    ];
    const chosen = order.map((s) => place[s]).find((p) => p.fits);
    // Se nada couber (elemento muito grande), fica no canto de baixo da tela.
    setPosition(
      chosen
        ? { top: chosen.top, left: chosen.left }
        : { top: vh - ch - MARGIN, left: centerLeft },
    );
  }, [rect, mobile, step.side, index]);

  // Foco no cartão a cada passo.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Teclado: setas navegam, Esc pula, Tab fica dentro do cartão.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onSkip();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onNext();
      } else if (e.key === "ArrowLeft" && !isFirst) {
        e.preventDefault();
        onBack();
      } else if (e.key === "Tab") {
        const focusable = Array.from(
          cardRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [],
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === cardRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isFirst, onBack, onNext, onSkip]);

  const container = element.closest("dialog") ?? document.body;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {/* Bloqueia cliques na tela enquanto o tutorial está aberto. */}
      <div className="pointer-events-auto fixed inset-0" aria-hidden="true" />

      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed rounded-xl border-2 border-violeta"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(18, 9, 31, 0.6)",
          }}
        />
      )}

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-describedby={textId}
        aria-label={step.title}
        tabIndex={-1}
        className={
          mobile
            ? "pointer-events-auto fixed inset-x-0 bottom-0 max-h-[70dvh] overflow-y-auto rounded-t-xl border border-violeta/10 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-tinta shadow-xl outline-none"
            : "pointer-events-auto fixed w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-violeta/10 bg-white p-4 text-tinta shadow-xl outline-none"
        }
        style={mobile ? undefined : { top: position?.top ?? -9999, left: position?.left ?? -9999 }}
      >
        <p className="text-xs font-semibold text-tinta/60">
          {index + 1} de {total}
        </p>
        <h2 id={titleId} className="mt-1 text-base font-extrabold leading-tight">
          {step.title}
        </h2>
        <p id={textId} className="mt-1 text-sm leading-snug text-tinta/80">
          {step.text}
        </p>

        <div className="mt-4 flex gap-2">
          {!isFirst && (
            <Button variant="secondary" onClick={onBack}>
              Voltar
            </Button>
          )}
          <Button className="min-w-0 flex-1" onClick={onNext}>
            {isLast ? "Concluir" : "Próximo"}
          </Button>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="mx-auto mt-1 flex min-h-11 items-center px-3 text-sm leading-tight text-tinta/70 underline hover:text-tinta focus-visible:outline-2 focus-visible:outline-violeta"
        >
          Pular tutorial
        </button>
      </div>
    </div>,
    container,
  );
}
