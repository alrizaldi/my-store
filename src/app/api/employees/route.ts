import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const roleId = searchParams.get("roleId") ?? undefined;
    const isActiveParam = searchParams.get("isActive");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const isActive =
      isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(roleId && { roleId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        select: {
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
        },
      }),
    ]);

    return Response.json({ data: users, total, page, limit });
  } catch (error) {
    console.error("[GET /api/employees]", error);
    return Response.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, avatar, roleId } = body as {
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      avatar?: string;
      roleId?: string;
    };

    if (!name || !email || !password || !roleId) {
      return Response.json(
        { error: "name, email, password, and roleId are required" },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        avatar,
        roleId,
      },
      select: {
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
      },
    });

    return Response.json(user, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/employees]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json({ error: "Email already in use" }, { status: 409 });
    }
    return Response.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
