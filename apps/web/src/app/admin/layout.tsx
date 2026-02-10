import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/admin/login");
  }

  return (
    <main className="page-shell grid">
      <section className="surface">
        <header className="header">
          <div className="brand">
            <h1>BotPass Admin</h1>
            <p>System control panel</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/admin/login" });
            }}
          >
            <button type="submit" className="secondary">
              Sign out
            </button>
          </form>
        </header>
        <nav className="nav" style={{ marginBottom: 16 }}>
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/agents">Agents</Link>
          <Link href="/admin/events">Events</Link>
          <Link href="/admin/risk">Risk</Link>
        </nav>
        {children}
      </section>
    </main>
  );
}
