import { redirect } from "next/navigation";
import { currentUser } from "./auth";

export async function requireUser() {
  try {
    return await currentUser();
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Unauthorized") ||
        error.message.startsWith("Authentication"))
    )
      redirect("/login");
    throw error;
  }
}
