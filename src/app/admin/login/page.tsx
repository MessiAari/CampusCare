import { LoginForm } from "@/components/admin/LoginForm";
import { DEMO_ADMINS, DEMO_PASSWORD, isDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default function AdminLogin({ searchParams }: { searchParams: { e?: string } }) {
  return (
    <div className="panel-dark relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="dots-light absolute inset-0" />
      <div className="float-slow absolute -left-24 top-10 h-80 w-80 rounded-full bg-[#2FA896]/30 blur-3xl" />
      <div className="float absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-amber/20 blur-3xl" />
      <LoginForm
        notAdmin={searchParams.e === "not-admin"}
        demo={isDemo() ? { password: DEMO_PASSWORD, accounts: DEMO_ADMINS.map((a) => ({ email: a.email, role: a.role })) } : undefined}
      />
    </div>
  );
}
