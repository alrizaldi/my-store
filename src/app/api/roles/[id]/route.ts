import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const roleInclude = {
  _count: {
    select: { users: true },
  },
} as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: roleInclude,
    });

    if (!role) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    return Response.json(role);
  } catch (error) {
    console.error("[GET /api/roles/[id]]", error);
    return Response.json({ error: "Failed to fetch role" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, permissions } = body as {
      name?: string;
      permissions?: string[];
    };

    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(permissions !== undefined && { permissions }),
      },
      include: roleInclude,
    });

    return Response.json(role);
  } catch (error: unknown) {
    console.error("[PATCH /api/roles/[id]]", error);
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code: string }).code;
      if (code === "P2025") {
        return Response.json({ error: "Role not found" }, { status: 404 });
      }
      if (code === "P2002") {
        return Response.json({ error: "Role name already exists" }, { status: 409 });
      }
    }
    return Response.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const role = await prisma.role.findUnique({
      where: { id },
      include: roleInclude,
    });

    if (!role) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    if (role._count.users > 0) {
      return Response.json(
        { error: "Cannot delete role with assigned users" },
        { status: 400 }
      );
    }

    await prisma.role.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/roles/[id]]", error);
    return Response.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
