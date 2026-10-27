import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { entraSettings, provisionedEntraUser } from "@/lib/entra";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const settings = entraSettings();
  return {
    secret: settings?.secret,
    trustHost: true,
    session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
    pages: { signIn: "/login", error: "/login" },
    providers: settings
      ? [
          MicrosoftEntraID({
            clientId: settings.clientId,
            clientSecret: settings.clientSecret,
            issuer: `https://login.microsoftonline.com/${settings.tenantId}/v2.0`,
            authorization: { params: { scope: "openid profile email" } },
            checks: ["pkce", "state", "nonce"],
            profile(profile) {
              return {
                id: profile.oid,
                name: profile.name,
                email: profile.email,
                image: null,
              };
            },
          }),
        ]
      : [],
    callbacks: {
      async signIn({ profile }) {
        return !!(await provisionedEntraUser(profile));
      },
      async jwt({ token, account, profile }) {
        if (account) {
          const staff = await provisionedEntraUser(profile);
          if (!staff) return null;
          token.staffId = staff.id;
          token.tenantId = settings!.tenantId;
        }
        if (token.tenantId !== settings?.tenantId) return null;
        return token;
      },
      async session({ session, token }) {
        session.user.id =
          typeof token.staffId === "string" ? token.staffId : "";
        return session;
      },
    },
    logger: {
      error(error) {
        console.error("Staff sign-in failed", error.name);
      },
    },
  };
});
