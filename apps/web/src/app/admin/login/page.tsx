"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("1015");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false
    });

    setLoading(false);

    if (!result?.ok) {
      setError("Login failed. Check username/password.");
      return;
    }

    router.replace("/admin");
  }

  return (
    <main className="page-shell">
      <section className="surface" style={{ maxWidth: 460, margin: "40px auto" }}>
        <h2 style={{ marginTop: 0 }}>Admin Login</h2>
        <p className="muted">Use seeded credentials to access management features.</p>

        <form className="grid" onSubmit={onSubmit}>
          <label>
            Username
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {error ? (
          <p style={{ color: "var(--danger)", marginTop: 10 }} role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
