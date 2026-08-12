import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/");

  const params = await searchParams;

  return (
    <main className="login-shell">
      <div className="login-card">
        <div>
          <p className="eyebrow">Secret Mafia Club</p>
          <h1>Invite Desk</h1>
          <p className="login-copy">
            Shared team access. Enter the password, plus your name so edits are
            attributable.
          </p>
        </div>
        <form action="/api/login" method="post">
          <label>
            Your name
            <input name="name" placeholder="e.g. Dahni" required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          {params.error ? (
            <p className="login-error">Wrong password. Try again.</p>
          ) : null}
          <button type="submit" className="primary-btn">
            Enter desk
          </button>
        </form>
      </div>
    </main>
  );
}
