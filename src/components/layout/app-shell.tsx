"use client";

import { useState, type ReactNode } from "react";
import type { Role } from "@/lib/permissions";
import type { Plan } from "@/lib/plans";
import { can } from "@/lib/permissions";
import type { StoreOption } from "@/components/layout/store-switcher";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TrialBanner } from "@/components/layout/trial-banner";
import type { AccessNotice, AccessStatus } from "@/lib/billing/access-types";

export function AppShell({
  plan,
  role,
  stores,
  activeTenantId,
  accessStatus,
  accessNotice,
  trialDaysLeft,
  children,
}: {
  plan: Plan;
  role: Role;
  stores: StoreOption[];
  activeTenantId: string;
  accessStatus: AccessStatus;
  accessNotice: AccessNotice | null;
  trialDaysLeft: number | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar plan={plan} role={role} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setOpen(true)} stores={stores} activeTenantId={activeTenantId} />
        <TrialBanner
          status={accessStatus}
          daysLeft={trialDaysLeft}
          notice={accessNotice}
          showButton={can(role, "view_subscription")}
        />
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
