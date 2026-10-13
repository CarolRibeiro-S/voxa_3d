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
import { createClient } from "@/lib/supabase/client";
import { loginSchema, translateAuthError, type LoginValues } from "@/lib/auth";

export function LoginForm({ next = "/painel" }: { next?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setFormError(null);
    const { error } = await createClient().auth.signInWithPassword(values);
    if (error) {
      setFormError(translateAuthError(error.message));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <Card>
      <h1 className="mb-6 text-xl font-extrabold">Entrar</h1>
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
            autoComplete="current-password"
            invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <OrDivider />
      <GoogleButton next={next} />
      <p className="mt-6 text-center text-sm text-tinta/70">
        Ainda não tem conta?{" "}
        <Link
          href={next === "/painel" ? "/cadastro" : `/cadastro?next=${encodeURIComponent(next)}`}
          className="font-semibold text-violeta hover:text-violeta-escuro"
        >
          Criar conta
        </Link>
      </p>
    </Card>
  );
}
