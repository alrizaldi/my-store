import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboardService";

export async function GET(_request: NextRequest) {
  try {
    // Verify authentication
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("auth-token");

    if (!tokenCookie?.value) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(tokenCookie.value);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get dashboard data using the shared service
    const data = await getDashboardData();

    return Response.json(data);
  } catch (error) {
    console.error("[GET /api/dashboard]", error);
    return Response.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
