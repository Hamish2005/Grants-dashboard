import Image from "next/image";
import { entraSettings } from "@/lib/entra";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const ready = !!entraSettings();
  return (
    <main className="auth-screen">
      <section className="panel login-panel">
        <Image
          src="/brand/rtfh-logo.svg"
          alt="Regional Task Force on Homelessness, San Diego"
          width={210}
          height={108}
          unoptimized
          loading="eager"
        />
        <p className="eyebrow">GRANTS WORKSPACE</p>
        <h1>Welcome back</h1>
        <a className="login-button" href="/demo">
          Try the demo — no sign-in needed
        </a>
        <p>
          Explore fictional grants in your own browser workspace. No setup
          required.
        </p>
        <p>
          Sign in with your organization’s Microsoft account to manage grants,
          deadlines, and team tasks.
        </p>
        {error && (
          <p role="alert" className="login-notice">
            {error === "AccessDenied"
              ? "Your account does not have workspace access. Ask your workspace administrator to provision your staff account."
              : "Sign-in could not be completed. Please try again or contact your workspace administrator."}
          </p>
        )}
        {ready ? (
          <form action={login}>
            <button className="login-button" type="submit">
              Sign in with Microsoft
            </button>
          </form>
        ) : (
          <p className="login-notice" role="status">
            Staff sign-in is being configured. Please contact your workspace
            administrator.
          </p>
        )}
        <small>
          For approved staff only. Access is managed by your workspace
          administrator.
        </small>
      </section>
    </main>
  );
}
