import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        stockMovements: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }

    return Response.json(product);
  } catch (error) {
    console.error("[GET /api/products/[id]]", error);
    return Response.json({ error: "Failed to fetch product" }, { status: 500 });
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
      sku,
      name,
      description,
      price,
      cost,
      stock,
      minStock,
      imageUrl,
      categoryId,
      isActive,
    } = body as {
      sku?: string;
      name?: string;
      description?: string;
      price?: number;
      cost?: number;
      stock?: number;
      minStock?: number;
      imageUrl?: string;
      categoryId?: string | null;
      isActive?: boolean;
    };

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(sku !== undefined && { sku }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(cost !== undefined && { cost: Number(cost) }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(minStock !== undefined && { minStock: Number(minStock) }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(categoryId !== undefined && { categoryId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { category: true },
    });

    return Response.json(product);
  } catch (error: unknown) {
    console.error("[PATCH /api/products/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }
    return Response.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("[DELETE /api/products/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }
    return Response.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
