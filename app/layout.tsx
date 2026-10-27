import type { Metadata } from "next";
import "./globals.css";
import { currentUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: "RTFH | Grants workspace",
  description: "Internal grant lifecycle and coordination workspace",
  icons: { icon: "/brand/rtfh-mark.png", apple: "/brand/rtfh-mark.png" },
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await currentUser();
  } catch (e) {
    return (
      <html lang="en">
        <body>
          <div className="auth-screen">
            <div className="panel">
              <h1>Grants workspace</h1>
              <p>{e instanceof Error ? e.message : "Sign-in required"}</p>
              <p>
                Local setup: copy .env.example to .env, run npm run db:setup,
                then npm run dev.
              </p>
              <p>
                Production requires the configured internal identity gateway.
              </p>
            </div>
          </div>
        </body>
      </html>
    );
  }
  return (
    <html lang="en">
      <body>
        <Shell name={user.name} role={user.role}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
