import { getTokenFromCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const token = await getTokenFromCookie();
  if (!token) {
    redirect("/");
  }
  return <DashboardClient />;
}
