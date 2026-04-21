import { type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email: string; password: string };

    if (!email || !password) {
      return Response.json({ error: "email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const passwordMatch = await comparePassword(password, user.password);
    if (!passwordMatch) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.isActive) {
      return Response.json({ error: "Account is inactive" }, { status: 403 });
    }

    const token = await signToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions,
    });

    const cookieStore = await cookies();
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      maxAge: 60 * 60 * 8, // 8 hours in seconds
      path: "/",
      sameSite: "lax",
    });

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
      },
    });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
