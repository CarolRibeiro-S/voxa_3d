"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton(props: Omit<ButtonProps, "onClick" | "children">) {
  const router = useRouter();

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button onClick={handleSignOut} {...props}>
      <LogOut size={16} />
      Sair
    </Button>
  );
}
