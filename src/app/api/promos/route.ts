import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PromoType } from "@prisma/client";

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
              { code: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.promo.findMany({
        where,
        include: {
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.promo.count({ where }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/promos]", error);
    return Response.json({ error: "Failed to fetch promos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      code,
      type,
      value,
      minOrder,
      maxDiscount,
      startDate,
      endDate,
    } = body as {
      name: string;
      description?: string;
      code?: string;
      type: PromoType;
      value: number;
      minOrder?: number;
      maxDiscount?: number;
      startDate: string;
      endDate: string;
    };

    // Required field validation
    if (!name || name.trim() === "") {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    if (!type) {
      return Response.json({ error: "type is required" }, { status: 400 });
    }
    if (!Object.values(PromoType).includes(type)) {
      return Response.json(
        { error: `type must be one of: ${Object.values(PromoType).join(", ")}` },
        { status: 400 }
      );
    }
    if (value === undefined || value === null) {
      return Response.json({ error: "value is required" }, { status: 400 });
    }
    if (Number(value) <= 0) {
      return Response.json({ error: "value must be greater than 0" }, { status: 400 });
    }
    if (type === PromoType.PERCENTAGE && (Number(value) < 1 || Number(value) > 100)) {
      return Response.json(
        { error: "value must be between 1 and 100 for PERCENTAGE type" },
        { status: 400 }
      );
    }
    if (!startDate) {
      return Response.json({ error: "startDate is required" }, { status: 400 });
    }
    if (!endDate) {
      return Response.json({ error: "endDate is required" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      return Response.json({ error: "startDate is invalid" }, { status: 400 });
    }
    if (isNaN(end.getTime())) {
      return Response.json({ error: "endDate is invalid" }, { status: 400 });
    }
    if (start >= end) {
      return Response.json(
        { error: "startDate must be before endDate" },
        { status: 400 }
      );
    }

    const promo = await prisma.promo.create({
      data: {
        name: name.trim(),
        description: description ?? null,
        code: code?.trim() ?? null,
        type,
        value: Number(value),
        minOrder: minOrder !== undefined ? Number(minOrder) : null,
        maxDiscount: maxDiscount !== undefined ? Number(maxDiscount) : null,
        startDate: start,
        endDate: end,
      },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    return Response.json(promo, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/promos]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json({ error: "Promo code already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to create promo" }, { status: 500 });
  }
}
