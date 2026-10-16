"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/or-divider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authCallbackUrl } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, translateAuthError, type SignupValues } from "@/lib/auth";

export function SignupForm({ next = "/painel" }: { next?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit({ email, password }: SignupValues) {
    setFormError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(next, window.location.origin),
      },
    });
    if (error) {
      setFormError(translateAuthError(error.message));
      return;
    }
    if (data.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    // Projeto com confirmação de e-mail ativada: ainda não há sessão.
    setNeedsConfirmation(true);
  }

  if (needsConfirmation) {
    return (
      <Card>
        <h1 className="mb-2 text-xl font-extrabold">Confira seu e-mail</h1>
        <p className="text-sm text-tinta/70">
          Enviamos um link de confirmação. Depois de confirmar, volte e entre na
          sua conta.
        </p>
        <Link
          href="/login"
          className="mt-6 block text-center text-sm font-semibold text-violeta hover:text-violeta-escuro"
        >
          Ir para o login
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="mb-6 text-xl font-extrabold">Criar conta</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            invalid={!!errors.email}
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
      <OrDivider />
      <GoogleButton next={next} />
      <p className="mt-6 text-center text-sm text-tinta/70">
        Já tem conta?{" "}
        <Link
          href={next === "/painel" ? "/login" : `/login?next=${encodeURIComponent(next)}`}
          className="font-semibold text-violeta hover:text-violeta-escuro"
        >
          Entrar
        </Link>
      </p>
    </Card>
  );
}
