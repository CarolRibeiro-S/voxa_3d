import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-4">
      <Logo className="text-4xl" />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
