import { safeNextPath } from "@/lib/safe-redirect";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Criar conta | Voxa3D" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <SignupForm next={safeNextPath(next)} />;
}
