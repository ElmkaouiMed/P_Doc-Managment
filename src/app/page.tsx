import { redirect } from "next/navigation";
import { getAuthContext } from "@/features/auth/lib/session";

export default async function Home() {
  const auth = await getAuthContext();
  if (auth) {
    redirect("/dashboard");
  }
  redirect("/login");
}
