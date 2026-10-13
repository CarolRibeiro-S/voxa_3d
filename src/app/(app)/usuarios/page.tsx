import { Card } from "@/components/ui/card";
import { emailSendingEnabled, getMaxUsers, listPendingInvites, listTeamMembers } from "@/lib/invites";
import { can, normalizeRole } from "@/lib/permissions";
import { guardPage } from "@/lib/permissions-server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/plans";
import { getCurrentTenant, getCurrentUser } from "@/lib/tenant";
import { AutoTour } from "@/components/tour/tour-provider";
import { UsersView, type InviteItem, type MemberItem } from "./users-view";

export const metadata = { title: "Usuários | Voxa3D" };

// A leitura usa o cliente admin só depois de conferir a capacidade (view_users) da função.
async function loadTeam(tenantId: string, plan: Plan, userId: string | undefined) {
  if (!hasAdminClient()) {
    console.error("SUPABASE_SERVICE_ROLE_KEY ausente: a página Usuários não pode listar os usuários.");
    return null;
  }
  try {
    const admin = createAdminClient();
    const [members, invites, max] = await Promise.all([
      listTeamMembers(admin, tenantId),
      listPendingInvites(admin, tenantId),
      getMaxUsers(plan),
    ]);
    const memberItems: MemberItem[] = members.map((m) => ({
      userId: m.userId,
      email: m.email,
      name: m.name,
      role: normalizeRole(m.role),
      since: m.since,
      isYou: m.userId === userId,
    }));
    const inviteItems: InviteItem[] = invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expiresAt,
    }));
    return { memberItems, inviteItems, max };
  } catch (error) {
    console.error("Erro ao carregar os usuários:", error instanceof Error ? error.message : "desconhecido");
    return null;
  }
}

export default async function UsuariosPage() {
  const current = await getCurrentTenant();
  if (!current) return null; // O layout já mostra o erro de conta.
  guardPage(current.role, "view_users");
  const user = await getCurrentUser();

  const team = await loadTeam(current.tenant.id, current.tenant.plan, user?.id);

  if (!team) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-extrabold text-tinta">Usuários</h1>
        <Card className="border-red-200 bg-red-50">
          <p role="alert" className="text-sm font-medium text-red-700">
            Não foi possível carregar os usuários agora.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <UsersView
        members={team.memberItems}
        invites={team.inviteItems}
        max={team.max}
        canManage={can(current.role, "manage_users") && !current.access.readOnly}
        emailEnabled={emailSendingEnabled()}
      />
      <AutoTour id="usuarios" />
    </div>
  );
}
