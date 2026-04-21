import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatar: true,
  isActive: true,
  roleId: true,
  createdAt: true,
  updatedAt: true,
  role: true,
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) {
      return Response.json({ error: "Employee not found" }, { status: 404 });
    }

    return Response.json(user);
  } catch (error) {
    console.error("[GET /api/employees/[id]]", error);
    return Response.json({ error: "Failed to fetch employee" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, phone, avatar, roleId, isActive, password } = body as {
      name?: string;
      phone?: string;
      avatar?: string;
      roleId?: string;
      isActive?: boolean;
      password?: string;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (avatar !== undefined) data.avatar = avatar;
    if (roleId !== undefined) data.roleId = roleId;
    if (isActive !== undefined) data.isActive = isActive;
    if (password !== undefined) data.password = await hashPassword(password);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });

    return Response.json(user);
  } catch (error: unknown) {
    console.error("[PATCH /api/employees/[id]]", error);
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code === "P2025") {
        return Response.json({ error: "Employee not found" }, { status: 404 });
      }
    }
    return Response.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/employees/[id]]", error);
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code === "P2025") {
        return Response.json({ error: "Employee not found" }, { status: 404 });
      }
    }
    return Response.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
