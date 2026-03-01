import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default function SearchLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = getCurrentUser();
  if (!user) {
    redirect("/login?next=/search");
  }

  return children;
}
