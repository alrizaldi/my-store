import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get("auth-token");

    if (!tokenCookie?.value) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(tokenCookie.value);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    return Response.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions,
      },
    });
  } catch (error) {
    console.error("[GET /api/auth/me]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
