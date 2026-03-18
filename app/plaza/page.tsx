import { getTokenFromCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import PlazaClient from "./PlazaClient";

export default async function PlazaPage() {
  const token = await getTokenFromCookie();
  if (!token) {
    redirect("/");
  }
  return <PlazaClient />;
}
