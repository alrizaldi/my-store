import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PromoType } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const promo = await prisma.promo.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true },
        },
        products: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    if (!promo) {
      return Response.json({ error: "Promo not found" }, { status: 404 });
    }

    return Response.json(promo);
  } catch (error) {
    console.error("[GET /api/promos/[id]]", error);
    return Response.json({ error: "Failed to fetch promo" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
      isActive,
    } = body as {
      name?: string;
      description?: string;
      code?: string;
      type?: PromoType;
      value?: number;
      minOrder?: number;
      maxDiscount?: number;
      startDate?: string;
      endDate?: string;
      isActive?: boolean;
    };

    if (name !== undefined && name.trim() === "") {
      return Response.json({ error: "name cannot be empty" }, { status: 400 });
    }

    if (type !== undefined && !Object.values(PromoType).includes(type)) {
      return Response.json(
        { error: `type must be one of: ${Object.values(PromoType).join(", ")}` },
        { status: 400 }
      );
    }

    if (value !== undefined && Number(value) <= 0) {
      return Response.json({ error: "value must be greater than 0" }, { status: 400 });
    }

    // If updating type to PERCENTAGE or value with existing PERCENTAGE type, validate range
    if (type === PromoType.PERCENTAGE && value !== undefined && (Number(value) < 1 || Number(value) > 100)) {
      return Response.json(
        { error: "value must be between 1 and 100 for PERCENTAGE type" },
        { status: 400 }
      );
    }

    // Re-validate dates if either is provided
    let start: Date | undefined;
    let end: Date | undefined;

    if (startDate !== undefined) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        return Response.json({ error: "startDate is invalid" }, { status: 400 });
      }
    }
    if (endDate !== undefined) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        return Response.json({ error: "endDate is invalid" }, { status: 400 });
      }
    }

    if (start !== undefined && end !== undefined && start >= end) {
      return Response.json(
        { error: "startDate must be before endDate" },
        { status: 400 }
      );
    }

    // If only one date is provided, fetch the existing record to compare
    if ((start !== undefined && end === undefined) || (start === undefined && end !== undefined)) {
      const existing = await prisma.promo.findUnique({
        where: { id },
        select: { startDate: true, endDate: true },
      });
      if (!existing) {
        return Response.json({ error: "Promo not found" }, { status: 404 });
      }
      const effectiveStart = start ?? existing.startDate;
      const effectiveEnd = end ?? existing.endDate;
      if (effectiveStart >= effectiveEnd) {
        return Response.json(
          { error: "startDate must be before endDate" },
          { status: 400 }
        );
      }
    }

    const promo = await prisma.promo.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(code !== undefined && { code: code.trim() || null }),
        ...(type !== undefined && { type }),
        ...(value !== undefined && { value: Number(value) }),
        ...(minOrder !== undefined && { minOrder: Number(minOrder) }),
        ...(maxDiscount !== undefined && { maxDiscount: Number(maxDiscount) }),
        ...(start !== undefined && { startDate: start }),
        ...(end !== undefined && { endDate: end }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: { orders: true },
        },
        products: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    return Response.json(promo);
  } catch (error: unknown) {
    console.error("[PATCH /api/promos/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Promo not found" }, { status: 404 });
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json({ error: "Promo code already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to update promo" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const promo = await prisma.promo.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!promo) {
      return Response.json({ error: "Promo not found" }, { status: 404 });
    }

    if (promo._count.orders > 0) {
      return Response.json(
        { error: "Cannot delete promo used in orders" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.promoProduct.deleteMany({ where: { promoId: id } });
      await tx.promo.delete({ where: { id } });
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/promos/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Promo not found" }, { status: 404 });
    }
    return Response.json({ error: "Failed to delete promo" }, { status: 500 });
  }
}
