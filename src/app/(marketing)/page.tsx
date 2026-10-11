import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { buttonClasses } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <Logo className="text-5xl" />
      <p className="max-w-md text-tinta/70">
        Gestão simples para o seu negócio de impressão 3D.
      </p>
      <Link href="/login" className={buttonClasses({ size: "lg" })}>
        Entrar
      </Link>
    </main>
  );
}
