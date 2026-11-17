import { redirect } from "next/navigation";
import { ReportWizard } from "@/components/student/ReportWizard";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const session = await getSession();
  if (!session?.anon_id) redirect("/");
  return (
    <div className="rise mx-auto max-w-2xl">
      <ReportWizard />
    </div>
  );
}
