import type { Metadata } from "next";
import "./globals.css";
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
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
