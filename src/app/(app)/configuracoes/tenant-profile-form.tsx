"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatPhone, normalizePhoneDigits } from "@/lib/format";
import {
  tenantProfileSchema,
  type TenantProfileInput,
  type TenantProfileValues,
} from "@/lib/tenant-profile-schema";
import { saveTenantProfile } from "./actions";

export function TenantProfileForm({ initial }: { initial: TenantProfileInput }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<TenantProfileInput, unknown, TenantProfileValues>({
    resolver: zodResolver(tenantProfileSchema),
    defaultValues: initial,
  });

  function onSubmit() {
    setMessage(null);
    const values = getValues();
    startTransition(async () => {
      const result = await saveTenantProfile(values);
      if (result.ok) {
        reset(values);
        setMessage({ ok: true, text: "Dados salvos." });
      } else {
        setMessage({ ok: false, text: result.message });
      }
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-extrabold">Dados do orçamento</h2>
      <p className="mt-1 text-sm text-tinta/70">
        Estas informações aparecem no topo dos seus orçamentos em PDF.
      </p>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="mt-6 space-y-6" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <FormField
              id="business_name"
              label="Nome da empresa"
              help="Se ficar vazio, o PDF usa o nome da sua conta."
              error={errors.business_name?.message}
            >
              {(a) => (
                <Input
                  {...register("business_name")}
                  id={a.id}
                  maxLength={80}
                  autoComplete="off"
                  invalid={a.invalid}
                  aria-describedby={a.describedBy}
                />
              )}
            </FormField>
          </div>

          <Controller
            control={control}
            name="whatsapp"
            render={({ field, fieldState }) => (
              <FormField
                id="whatsapp"
                label="WhatsApp"
                help="Com DDD, só números."
                error={fieldState.error?.message}
              >
                {(a) => (
                  <Input
                    ref={field.ref}
                    id={a.id}
                    name={field.name}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={20}
                    placeholder="(61) 99999-0000"
                    value={formatPhone(field.value ?? "")}
                    onChange={(e) => field.onChange(normalizePhoneDigits(e.target.value).slice(0, 13))}
                    onBlur={field.onBlur}
                    invalid={a.invalid}
                    aria-describedby={a.describedBy}
                  />
                )}
              </FormField>
            )}
          />

          <Controller
            control={control}
            name="instagram"
            render={({ field, fieldState }) => (
              <FormField
                id="instagram"
                label="Instagram"
                help="Sem o @."
                error={fieldState.error?.message}
              >
                {(a) => (
                  <Input
                    ref={field.ref}
                    id={a.id}
                    name={field.name}
                    autoComplete="off"
                    autoCapitalize="none"
                    maxLength={31}
                    placeholder="minhaloja3d"
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value.replace(/^@+/, ""))}
                    onBlur={field.onBlur}
                    invalid={a.invalid}
                    aria-describedby={a.describedBy}
                  />
                )}
              </FormField>
            )}
          />
        </div>

        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={message.ok ? "text-sm font-medium text-green-700" : "text-sm text-red-600"}
          >
            {message.text}
          </p>
        )}

        <Button type="submit" disabled={!isDirty || pending} className="w-full md:w-auto">
          {pending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          Salvar dados
        </Button>
      </form>
    </Card>
  );
}
