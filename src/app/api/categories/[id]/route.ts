import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    return Response.json(category);
  } catch (error) {
    console.error("[GET /api/categories/[id]]", error);
    return Response.json({ error: "Failed to fetch category" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body as { name?: string; description?: string };

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return Response.json(category);
  } catch (error: unknown) {
    console.error("[PATCH /api/categories/[id]]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error
    ) {
      const code = (error as { code: string }).code;
      if (code === "P2025") {
        return Response.json({ error: "Category not found" }, { status: 404 });
      }
      if (code === "P2002") {
        return Response.json({ error: "Category name already exists" }, { status: 409 });
      }
    }
    return Response.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    if (category._count.products > 0) {
      return Response.json(
        { error: "Cannot delete category with products" },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/categories/[id]]", error);
    return Response.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
