/* Phase 3 DB verification: counts, orphans, and the new payment columns. */
import('@prisma/client').then(async ({ PrismaClient }) => {
  const c = new PrismaClient();
  const counts = {
    orders: await c.order.count(),
    shipments: await c.shipment.count(),
    ordersWithProof: await c.order.count({ where: { paymentProofUrl: { not: null } } }),
    paidOrders: await c.order.count({ where: { paymentStatus: 'PAID' } }),
    pendingOrders: await c.order.count({ where: { paymentStatus: 'PENDING' } }),
    failedOrders: await c.order.count({ where: { paymentStatus: 'FAILED' } }),
    refundedOrders: await c.order.count({ where: { paymentStatus: 'REFUNDED' } }),
    testLeftoverUsers: await c.user.count({ where: { email: { startsWith: 'phase' } } }),
  };
  const orphanShipments = await c.$queryRaw`SELECT COUNT(*)::int AS n FROM shipments s LEFT JOIN orders o ON o.id = s."orderId" WHERE o.id IS NULL`;
  const orphanItems = await c.$queryRaw`SELECT COUNT(*)::int AS n FROM order_items oi LEFT JOIN orders o ON o.id = oi."orderId" WHERE o.id IS NULL`;
  const cols = await c.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name IN ('paidAt', 'paymentNote')`;
  console.log(JSON.stringify({
    ...counts,
    orphanShipments: orphanShipments[0].n,
    orphanOrderItems: orphanItems[0].n,
    paymentColumns: cols.map((r) => r.column_name),
  }, null, 1));
  await c.$disconnect();
});
