import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return Response.json(roles);
  } catch (error) {
    console.error("[GET /api/roles]", error);
    return Response.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, permissions } = body as {
      name?: string;
      permissions?: string[];
    };

    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const role = await prisma.role.create({
      data: {
        name,
        permissions: permissions ?? [],
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return Response.json(role, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/roles]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json({ error: "Role name already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to create role" }, { status: 500 });
  }
}
