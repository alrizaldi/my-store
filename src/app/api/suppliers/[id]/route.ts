import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });

    if (!supplier) {
      return Response.json({ error: "Supplier not found" }, { status: 404 });
    }

    return Response.json(supplier);
  } catch (error) {
    console.error("[GET /api/suppliers/[id]]", error);
    return Response.json({ error: "Failed to fetch supplier" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { name, phone, email, address, isActive } = body as {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      isActive?: boolean;
    };

    if (name !== undefined && name.trim() === "") {
      return Response.json({ error: "name cannot be empty" }, { status: 400 });
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });

    return Response.json(supplier);
  } catch (error: unknown) {
    console.error("[PATCH /api/suppliers/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Supplier not found" }, { status: 404 });
    }
    return Response.json({ error: "Failed to update supplier" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });

    if (!supplier) {
      return Response.json({ error: "Supplier not found" }, { status: 404 });
    }

    if (supplier._count.purchases > 0) {
      // Soft delete: mark as inactive
      await prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete: no associated purchases
      await prisma.supplier.delete({ where: { id } });
    }

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/suppliers/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Supplier not found" }, { status: 404 });
    }
    return Response.json({ error: "Failed to delete supplier" }, { status: 500 });
  }
}
