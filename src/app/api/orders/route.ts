import { type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

interface OrderItemInput {
  productId: string;
  quantity: number;
  discount?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
    const skip = (page - 1) * limit;
    const cashierId = searchParams.get("cashierId") ?? undefined;
    const sessionId = searchParams.get("sessionId") ?? undefined;

    const where: any = {};
    
    if (cashierId) where.cashierId = cashierId;
    if (sessionId) where.sessionId = sessionId;

    const [total, data] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          cashier: {
            select: { id: true, name: true },
          },
          session: {
            select: { id: true, startCash: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
          payments: true,
        },
      }),
    ]);

    return Response.json({ data, total, page, limit });
  } catch (error) {
    console.error("[GET /api/orders]", error);
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Validate that the session exists and belongs to this user
    if (sessionId) {
      const session = await prisma.cashierSession.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return Response.json({ error: "Session not found" }, { status: 404 });
      }

      if (session.status !== "OPEN") {
        return Response.json({ error: "Session is not open" }, { status: 400 });
      }

      // Check if the session belongs to the current user
      if (session.cashierId !== payload.userId) {
        return Response.json(
          { error: "You can only create orders in your own session" },
          { status: 403 }
        );
      }
    }

    // Check if all products exist and have sufficient stock
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true, stock: true },
    });

    // Validate quantities against stock
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        return Response.json({ error: `Product with id ${item.productId} not found` }, { status: 404 });
      }
      if (product.stock < item.quantity) {
        return Response.json(
          { error: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}` },
          { status: 400 }
        );
      }
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId)!;
      subtotal += product.price * item.quantity;
    }

    // Apply promo if provided
    let promo: {
      id: string;
      code: string | null;
      name: string;
      type: "PERCENTAGE" | "FIXED";
      value: number;
      minOrder: number | null;
      maxDiscount: number | null;
    } | null = null;

    if (promoId) {
      promo = await prisma.promo.findUnique({
        where: { id: promoId },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          value: true,
          minOrder: true,
          maxDiscount: true,
        },
      });

      if (!promo) {
        return Response.json({ error: "Invalid promo code" }, { status: 400 });
      }

      // Check if promo is active
      const now = new Date();
      const activePromos = await prisma.promo.findMany({
        where: {
          id: promoId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });

      if (activePromos.length === 0) {
        return Response.json({ error: "Promo is not active" }, { status: 400 });
      }
    }

    // Apply promo discount if applicable
    let discount = 0;
    if (promo && subtotal >= (promo.minOrder ?? 0)) {
      if (promo.type === "PERCENTAGE") {
        discount = Math.min(subtotal * (promo.value / 100), promo.maxDiscount ?? Infinity);
      } else {
        discount = promo.value;
      }
    }

    const taxable = subtotal - discount;
    const tax = taxRate ? taxable * taxRate : 0;
    const total = taxable + tax;

    // Create the order in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          cashierId: payload.userId,
          promoId: promo?.id,
          subtotal,
          discount,
          tax,
          total,
          sessionId: sessionId || null,
          items: {
            create: items.map((item) => {
              const product = products.find((p) => p.id === item.productId)!;
              return {
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: product.price,
                discount: 0, // Could be extended to support item-level discounts
              };
            }),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
      });

      // Update product stocks
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return newOrder;
    });

    // Generate order number after successful creation
    const orderNumber = `ORD-${String(order.id).padStart(6, "0")}`;
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { orderNumber },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        payments: true,
      },
    });

    return Response.json(updatedOrder, { status: 201 });
  } catch (error) {
    console.error("[POST /api/orders]", error);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }
}