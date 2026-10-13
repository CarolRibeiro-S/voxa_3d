"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GENERATE_PAYMENT_LABEL, GENERATE_PAYMENT_OPTIONS } from "@/lib/orders";
import { createOrderFromQuote } from "../../pedidos/actions";

type PaymentOption = (typeof GENERATE_PAYMENT_OPTIONS)[number];

// Gera o pedido do orçamento aprovado perguntando antes se o pagamento já foi recebido e,
// se quiser, o prazo de entrega. Se o orçamento já tem pedido, mostra o link.
export function GenerateOrderButton({
  quoteId,
  existing,
}: {
  quoteId: string;
  existing: { id: string; number: number } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [payment, setPayment] = useState<PaymentOption>("none");
  const [dueDate, setDueDate] = useState("");
  const [found, setFound] = useState(existing);

  if (found) {
    return (
      <p className="flex flex-wrap items-center gap-3 text-sm">
        <span>Este orçamento já tem o pedido #{found.number}</span>
        <Link href="/pedidos" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          Abrir pedidos
        </Link>
      </p>
    );
  }

  return (
    <div>
      <Button
        onClick={() => {
          setPayment("none");
          setDueDate("");
          setOpen(true);
        }}
      >
        <PackagePlus size={16} aria-hidden="true" />
        Gerar pedido
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Gerar pedido?"
        description="O pedido copia o cliente e os itens deste orçamento."
        confirmLabel="Gerar pedido"
        onConfirm={async () => {
          const result = await createOrderFromQuote(quoteId, { payment, due_date: dueDate });
          if (result.ok) {
            router.push("/pedidos");
            return { ok: true };
          }
          // Já existe pedido ativo: mostra o link em vez de erro.
          if (result.existing) {
            setFound(result.existing);
            return { ok: true };
          }
          return result;
        }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-semibold text-tinta">O pagamento já foi recebido?</legend>
          {GENERATE_PAYMENT_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex min-h-11 py-2 leading-tight cursor-pointer items-center gap-3 rounded-xl border border-violeta/20 px-3 text-sm font-medium has-[:checked]:border-violeta has-[:checked]:bg-nevoa"
            >
              <input
                type="radio"
                name="generate-payment"
                value={option}
                checked={payment === option}
                onChange={() => setPayment(option)}
                className="size-4 accent-violeta"
              />
              {GENERATE_PAYMENT_LABEL[option]}
            </label>
          ))}
        </fieldset>
        <div className="mt-3">
          <Label htmlFor="generate-due">Prazo de entrega (opcional)</Label>
          <Input
            id="generate-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
