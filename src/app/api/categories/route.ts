import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return Response.json(categories);
  } catch (error) {
    console.error("[GET /api/categories]", error);
    return Response.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body as { name: string; description?: string };

    if (!name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: { name, description },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return Response.json(category, { status: 201 });
  } catch (error: unknown) {
    console.error("[POST /api/categories]", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json({ error: "Category name already exists" }, { status: 409 });
    }
    return Response.json({ error: "Failed to create category" }, { status: 500 });
  }
}
