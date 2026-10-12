import { z } from "zod";
import { brPhoneError, normalizePhoneDigits } from "@/lib/format";

// Compartilhado entre cliente e servidor: sem imports de servidor aqui.

const INSTAGRAM_PATTERN = /^[A-Za-z0-9._]+$/;

export const tenantProfileSchema = z.object({
  business_name: z.string().trim().max(80, "Use até 80 caracteres"),
  whatsapp: z
    .string()
    .transform(normalizePhoneDigits)
    .superRefine((v, ctx) => {
      // Vazio é permitido. A validação do servidor é a que manda.
      const message = v === "" ? null : brPhoneError(v);
      if (message) ctx.addIssue({ code: "custom", message });
    }),
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@+/, ""))
    .pipe(
      z
        .string()
        .max(30, "Use até 30 caracteres")
        .refine((v) => v === "" || INSTAGRAM_PATTERN.test(v), {
          message: "Use apenas letras, números, ponto e sublinhado",
        }),
    ),
});

export type TenantProfileInput = z.input<typeof tenantProfileSchema>;
export type TenantProfileValues = z.output<typeof tenantProfileSchema>;
