import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) redirect("/login");

  const user = { name: payload.name, email: payload.email, role: payload.role };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={user} />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
