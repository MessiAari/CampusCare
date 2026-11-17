import { DemoControls } from "@/components/admin/DemoControls";
import { Sidebar } from "@/components/admin/Sidebar";
import { requireAdmin } from "@/lib/admin";
import { getOffsetMs } from "@/lib/clock";
import { isDemo } from "@/lib/demo";
import { checkEscalations } from "@/lib/escalation";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  // Escalate anything overdue every time an admin opens the panel.
  await checkEscalations().catch((e) => console.error("[escalation]", e));
  const offsetDays = isDemo() ? (await getOffsetMs()) / 86400_000 : 0;

  return (
    <div className="bg-admin flex min-h-screen">
      <Sidebar name={admin.name} role={admin.role} />
      <main className="min-w-0 flex-1 px-6 py-6 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      {isDemo() && <DemoControls offsetDays={offsetDays} />}
    </div>
  );
}
