import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default function SignupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = getCurrentUser();
  if (user) {
    redirect("/planning");
  }

  return children;
}
