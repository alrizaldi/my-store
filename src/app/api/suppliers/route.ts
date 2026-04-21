import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get("search") ?? undefined;
    const isActiveParam = searchParams.get("isActive");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const isActive =
      isActiveParam === "true"
        ? true
        : isActiveParam === "false"
        ? false
        : undefined;

    const where = {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: { purchases: true },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/suppliers]", error);
    return Response.json({ error: "Failed to fetch suppliers" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, address } = body as {
      name: string;
      phone?: string;
      email?: string;
      address?: string;
    };

    if (!name || name.trim() === "") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        phone: phone ?? null,
        email: email ?? null,
        address: address ?? null,
      },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });

    return Response.json(supplier, { status: 201 });
  } catch (error) {
    console.error("[POST /api/suppliers]", error);
    return Response.json({ error: "Failed to create supplier" }, { status: 500 });
  }
}
