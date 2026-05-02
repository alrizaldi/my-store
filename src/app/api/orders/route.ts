import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

interface OrderItemInput {
  productId: string;
  quantity: number;
  discount?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;

    const where = {
      ...(status
        ? {
            status: status as
              | "PENDING"
              | "COMPLETED"
              | "CANCELLED"
              | "REFUNDED",
          }
        : {}),
      ...(search
        ? { orderNumber: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.order.findMany({
        where,
        include: {
          cashier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          payments: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/orders]", error);
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, promoId, notes, sessionId, taxRate } = body as {
      items: OrderItemInput[];
      promoId?: string;
      notes?: string;
      sessionId?: string;
      taxRate?: number;
    };

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "items array is required and must not be empty" },
        { status: 400 },
      );
    }

    // Fetch all products
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    // Validate each item
    for (const item of items) {
      const product = products.find(
        (p: { id: string }) => p.id === item.productId,
      );
      if (!product) {
        return Response.json(
          { error: `Product ${item.productId} not found` },
          { status: 400 },
        );
      }
      if (!product.isActive) {
        return Response.json(
          { error: `Product "${product.name}" is not active` },
          { status: 400 },
        );
      }
      if (product.stock < item.quantity) {
        return Response.json(
          {
            error: `Insufficient stock for product "${product.name}". Available: ${product.stock}`,
          },
          { status: 400 },
        );
      }
    }

    // Calculate subtotals per item
    const itemsWithCalc = items.map((item) => {
      const product = products.find(
        (p: { id: string }) => p.id === item.productId,
      )!;
      const unitPrice = product.price;
      const discount = item.discount ?? 0;
      const subtotal = unitPrice * item.quantity - discount;
      return { ...item, product, unitPrice, discount, subtotal };
    });

    const subtotal = itemsWithCalc.reduce((sum, i) => sum + i.subtotal, 0);

    // Apply promo if provided
    let promoDiscount = 0;
    let validatedPromoId: string | null = promoId ?? null;

    if (promoId) {
      const promo = await prisma.promo.findUnique({ where: { id: promoId } });

      if (!promo) {
        return Response.json({ error: "Promo not found" }, { status: 400 });
      }

      const now = new Date();
      if (!promo.isActive || now < promo.startDate || now > promo.endDate) {
        return Response.json(
          { error: "Promo is not valid or has expired" },
          { status: 400 },
        );
      }

      if (promo.minOrder !== null && subtotal < promo.minOrder) {
        return Response.json(
          {
            error: `Order subtotal does not meet the minimum order amount for this promo`,
          },
          { status: 400 },
        );
      }

      if (promo.type === "PERCENTAGE") {
        promoDiscount = subtotal * (promo.value / 100);
      } else {
        promoDiscount = promo.value;
      }

      if (promo.maxDiscount !== null && promoDiscount > promo.maxDiscount) {
        promoDiscount = promo.maxDiscount;
      }

      validatedPromoId = promo.id;
    }

    // Apply tax
    const effectiveTaxRate = taxRate ?? 0;
    const taxAmount = subtotal * effectiveTaxRate;
    const total = subtotal - promoDiscount + taxAmount;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;

    // Get cashier ID from request header
    const cashierId = request.headers.get("x-user-id") ?? null;

    // Execute transaction: create order + items + decrement stock + stock movements
    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          subtotal,
          discount: promoDiscount,
          tax: taxAmount,
          total,
          notes: notes ?? null,
          cashierId,
          sessionId: sessionId ?? null,
          promoId: validatedPromoId,
          items: {
            create: itemsWithCalc.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              subtotal: item.subtotal,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
          payments: true,
        },
      });

      // Decrement stock and create StockMovement OUT records for each item
      for (const item of itemsWithCalc) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            type: "OUT",
            quantity: item.quantity,
            notes: `Sale - Order ${orderNumber}`,
            productId: item.productId,
            referenceId: createdOrder.id,
          },
        });
      }

      return createdOrder;
    });

    return Response.json(order, { status: 201 });
  } catch (error) {
    console.error("[POST /api/orders]", error);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }
}
