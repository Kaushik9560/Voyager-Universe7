import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default function PlanningLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = getCurrentUser();
  if (!user) {
    redirect("/login?next=/planning");
  }

  return children;
}
