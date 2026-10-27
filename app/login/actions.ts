"use server";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { entraSettings } from "@/lib/entra";

export async function login() {
  if (!entraSettings()) redirect("/login?error=Configuration");
  try {
    await signIn("microsoft-entra-id", { redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=AccessDenied");
    throw error;
  }
}
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
