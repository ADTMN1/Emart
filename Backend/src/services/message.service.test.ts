import assert from 'node:assert/strict';
import test from 'node:test';

import { MessageService } from './message.service';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';

/**
 * Unit tests for Admin ↔ Seller messaging (Phase 7). The service takes an
 * injectable Prisma client plus a fake seller-auth helper and a fake
 * notification service, so every test runs fully in memory — no database.
 */

interface NotificationCall {
  userId: string;
  type: string;
  title: string;
  body?: string;
  orderId?: string;
  conversationId?: string;
  messageId?: string;
}

interface AppFixture {
  prisma: any;
  notifications: { calls: NotificationCall[] };
  sellers: { userId: string; profileId: string; storeName: string; status: string }[];
  admins: string[];
}

function makeApp() {
  const fixture: AppFixture = {
    prisma: null as any,
    notifications: { calls: [] },
    sellers: [],
    admins: [],
  };

  const orders: any[] = [];
  const profiles: any[] = [];
  const users: any[] = [];
  const conversations: any[] = [];
  const messages: any[] = [];
  let nextId = 1;

  function matches(row: any, where: any): boolean {
    for (const [key, value] of Object.entries(where || {})) {
      if (key === 'orderId_sellerId') {
        const { orderId, sellerId } = value as any;
        if (row.orderId !== orderId || row.sellerId !== sellerId) return false;
        continue;
      }
      if (value && typeof value === 'object') {
        if ('in' in value) {
          if (!(value as any).in.includes(row[key])) return false;
          continue;
        }
        if ('not' in value) {
          if (row[key] === (value as any).not) return false;
          continue;
        }
        if (value === null) {
          if (row[key] !== null) return false;
          continue;
        }
      }
      if (row[key] !== value) return false;
    }
    return true;
  }

  function buildConversationRow(c: any) {
    const seller = profiles.find((p) => p.id === c.sellerId);
    const itsMessages = messages
      .filter((m) => m.conversationId === c.id)
      .sort((a, b) => b.createdAt - a.createdAt);
    const order = orders.find((o) => o.id === c.orderId);
    return {
      ...c,
      seller: seller ? { id: seller.id, storeName: seller.storeName } : null,
      messages: itsMessages.slice(0, 1).map((m) => ({
        id: m.id,
        body: m.body,
        senderUserId: m.senderUserId,
        sender: { role: users.find((u) => u.id === m.senderUserId)?.role || 'CUSTOMER' },
        createdAt: m.createdAt,
      })),
      order: order ? { id: order.id, orderNumber: order.orderNumber, status: order.status } : null,
    };
  }

  function withIncludes(c: any) {
    const seller = profiles.find((p) => p.id === c.sellerId);
    const order = orders.find((o) => o.id === c.orderId);
    return {
      ...c,
      seller: seller
        ? { id: seller.id, userId: seller.userId, storeName: seller.storeName }
        : null,
      order: order ? { id: order.id, orderNumber: order.orderNumber, status: order.status } : null,
    };
  }

  fixture.prisma = {
    order: {
      findUnique: async ({ where }: any) => orders.find((o) => o.id === where.id) || null,
    },
    sellerProfile: {
      findUnique: async ({ where }: any) => {
        if (where.id) return profiles.find((p) => p.id === where.id) || null;
        if (where.userId) return profiles.find((p) => p.userId === where.userId) || null;
        return null;
      },
      findMany: async ({ where }: any) =>
        profiles.filter((p) => (where.id?.in ? where.id.in.includes(p.id) : true) && (!where.status || p.status === where.status)),
    },
    conversation: {
      findUnique: async ({ where }: any) => {
        if (where.id) return conversations.find((c) => c.id === where.id) ? withIncludes(conversations.find((c) => c.id === where.id)) : null;
        if (where.orderId_sellerId) {
          const { orderId, sellerId } = where.orderId_sellerId;
          const found = conversations.find((c) => c.orderId === orderId && c.sellerId === sellerId);
          return found ? withIncludes(found) : null;
        }
        return null;
      },
      findFirst: async ({ where }: any) => {
        const found = conversations.find((c) => matches(c, where));
        return found ? withIncludes(found) : null;
      },
      findMany: async ({ where, skip = 0, take }: any) => {
        let rows = conversations.filter((c) => matches(c, where)).map(buildConversationRow);
        rows = rows.sort((a, b) => b.updatedAt - a.updatedAt);
        if (take !== undefined) rows = rows.slice(skip, skip + take);
        return rows;
      },
      create: async ({ data }: any) => {
        const row = { id: `c${nextId++}`, ...data, createdAt: new Date(), updatedAt: new Date() };
        conversations.push(row);
        return row;
      },
      count: async ({ where }: any) => conversations.filter((c) => matches(c, where)).length,
    },
    message: {
      findMany: async ({ where, orderBy }: any) => {
        let rows = messages.filter((m) => matches(m, where));
        if (orderBy?.createdAt === 'asc') rows = [...rows].sort((a, b) => a.createdAt - b.createdAt);
        return rows;
      },
      create: async ({ data }: any) => {
        const row = { id: `m${nextId++}`, createdAt: new Date(), readAt: null, ...data };
        messages.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const target = messages.filter((m) => matches(m, where));
        for (const m of target) m.readAt = data.readAt ?? m.readAt;
        return { count: target.length };
      },
      groupBy: async ({ where }: any) => {
        const counts = new Map<string, number>();
        for (const m of messages) {
          if (!matches(m, where)) continue;
          counts.set(m.conversationId, (counts.get(m.conversationId) || 0) + 1);
        }
        return [...counts.entries()].map(([conversationId, count]) => ({
          conversationId,
          _count: { _all: count },
        }));
      },
    },
    user: {
      findMany: async ({ where }: any) => {
        if (where.id?.in) return users.filter((u) => (where.id.in as string[]).includes(u.id));
        if (where.role) return users.filter((u) => u.role === where.role);
        return [];
      },
    },
  };

  const sellerAuth = {
    requireApprovedSeller: async (userId: string) => {
      const entry = fixture.sellers.find((s) => s.userId === userId);
      if (!entry) throw new NotFoundError('Seller profile not found.');
      const row = profiles.find((p) => p.id === entry.profileId);
      if (!row) throw new NotFoundError('Seller profile not found.');
      if (row.status !== 'APPROVED') throw new ForbiddenError('Seller account is not active.');
      return { id: entry.profileId, userId, storeName: row.storeName, status: row.status };
    },
  };

  const notifications = {
    calls: fixture.notifications.calls,
    create: async (input: NotificationCall) => {
      fixture.notifications.calls.push(input);
      return { id: 'n1', ...input };
    },
  };

  const service = new MessageService(fixture.prisma, notifications as any, sellerAuth);

  return {
    fixture,
    service,
    seed: {
      order(o: any) {
        orders.push({ status: 'PENDING', ...o });
      },
      profile(p: any) {
        profiles.push(p);
      },
      user(u: any) {
        users.push(u);
      },
      conversation(c: any) {
        conversations.push({ createdAt: new Date(), updatedAt: new Date(), ...c });
      },
      message(m: any) {
        messages.push({ readAt: null, createdAt: new Date(), ...m });
      },
      seller(profileId: string, userId: string, status = 'APPROVED') {
        return { profileId, userId, storeName: `Store ${profileId}`, status };
      },
    },
  };
}

test('listOrderConversations: missing order -> NotFoundError (404)', async () => {
  const { service } = makeApp();
  await assert.rejects(() => service.listOrderConversations('admin1', 'missing'), NotFoundError);
});

test('listOrderConversations: returns distinct sellers, conversations and admin unread counts', async () => {
  const app = makeApp();
  const { seed, service, fixture } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-10025', items: [{ product: { sellerId: 's1' } }, { product: { sellerId: 's1' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'APPROVED' });
  seed.user({ id: 'admin1', role: 'ADMIN' });
  seed.user({ id: 'seller-user-1', role: 'CUSTOMER' });
  seed.user({ id: 'admin2', role: 'ADMIN' });
  seed.conversation({ id: 'conv1', orderId: 'o1', sellerId: 's1' });
  seed.message({ id: 'm1', conversationId: 'conv1', senderUserId: 'seller-user-1', body: 'hi', readAt: null });

  const res = await service.listOrderConversations('admin1', 'o1');
  assert.equal(res.order.orderNumber, 'EM-10025');
  assert.equal(res.sellers.length, 1);
  assert.equal(res.sellers[0].storeName, 'ABC Store');
  assert.equal(res.conversations.length, 1);
  assert.equal(res.conversations[0].unreadCount, 1);
  assert.equal(res.conversations[0].lastMessage.body, 'hi');
});

test('getOrCreateConversation: seller not on the order -> ForbiddenError (403)', async () => {
  const app = makeApp();
  const { seed, service } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's1' } }] });
  seed.profile({ id: 's2', userId: 'seller-user-2', storeName: 'Other Store', status: 'APPROVED' });
  await assert.rejects(() => service.getOrCreateConversation('o1', 's2'), ForbiddenError);
});

test('getOrCreateConversation: non-APPROVED seller is rejected (403)', async () => {
  const app = makeApp();
  const { seed, service } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's1' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'SUSPENDED' });
  await assert.rejects(() => service.getOrCreateConversation('o1', 's1'), ForbiddenError);
});

test('getOrCreateConversation: creates once, then reuses the same conversation (no duplicates)', async () => {
  const app = makeApp();
  const { seed, service } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's1' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'APPROVED' });

  const first = await service.getOrCreateConversation('o1', 's1');
  const second = await service.getOrCreateConversation('o1', 's1');
  assert.equal(first.conversation.id, second.conversation.id);

  const res = await service.listOrderConversations('admin1', 'o1');
  assert.equal(res.conversations.length, 1, 'duplicate conversation must not be created');
});

test('one conversation per order+seller: two sellers get separate conversations', async () => {
  const app = makeApp();
  const { seed, service } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's1' } }, { product: { sellerId: 's2' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'Store A', status: 'APPROVED' });
  seed.profile({ id: 's2', userId: 'seller-user-2', storeName: 'Store B', status: 'APPROVED' });

  const a = await service.getOrCreateConversation('o1', 's1');
  const b = await service.getOrCreateConversation('o1', 's2');
  assert.notEqual(a.conversation.id, b.conversation.id);
  const res = await service.listOrderConversations('admin1', 'o1');
  assert.equal(res.sellers.length, 2);
  assert.equal(res.conversations.length, 2);
});

test('sendAdminMessage: rejects empty/whitespace body', async () => {
  const app = makeApp();
  const { seed, service } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's1' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'APPROVED' });
  seed.conversation({ id: 'conv1', orderId: 'o1', sellerId: 's1' });
  await assert.rejects(() => service.sendAdminMessage('admin1', 'conv1', '   '), ValidationError);
});

test('sendAdminMessage: creates message + seller notification', async () => {
  const app = makeApp();
  const { seed, service, fixture } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-10025', items: [{ product: { sellerId: 's1' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'APPROVED' });
  seed.conversation({ id: 'conv1', orderId: 'o1', sellerId: 's1' });

  const msg = await service.sendAdminMessage('admin1', 'conv1', '  Please confirm availability  ');
  assert.equal(msg.body, 'Please confirm availability');
  assert.equal(msg.senderUserId, 'admin1');
  assert.equal(fixture.notifications.calls.length, 1);
  const n = fixture.notifications.calls[0];
  assert.equal(n.userId, 'seller-user-1');
  assert.equal(n.type, 'MESSAGE');
  assert.equal(n.title, 'New message from EMART Admin');
  assert.equal(n.orderId, 'o1');
  assert.equal(n.conversationId, 'conv1');
  assert.equal(n.messageId, msg.id);
});

test('sendAdminMessage: conversation missing -> 404', async () => {
  const { service } = makeApp();
  await assert.rejects(() => service.sendAdminMessage('admin1', 'conv-missing', 'hello'), NotFoundError);
});

test('sendSellerReply: suspended seller denied (403)', async () => {
  const app = makeApp();
  const { seed, service, fixture } = app;
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'SUSPENDED' });
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's1' } }] });
  seed.conversation({ id: 'conv1', orderId: 'o1', sellerId: 's1' });
  fixture.sellers.push(seed.seller('s1', 'seller-user-1', 'SUSPENDED'));
  await assert.rejects(() => service.sendSellerReply('seller-user-1', 'conv1', 'hello'), ForbiddenError);
});

test('sendSellerReply: seller cannot reply in another seller\'s conversation (404)', async () => {
  const app = makeApp();
  const { seed, service, fixture } = app;
  fixture.sellers.push(seed.seller('s-a', 'seller-a'));
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's-b' } }] });
  seed.profile({ id: 's-b', userId: 'seller-b', storeName: 'Store B', status: 'APPROVED' });
  seed.conversation({ id: 'conv-b', orderId: 'o1', sellerId: 's-b' });
  await assert.rejects(() => service.sendSellerReply('seller-a', 'conv-b', 'hi'), NotFoundError);
});

test('sendSellerReply: notifies every ADMIN user', async () => {
  const app = makeApp();
  const { seed, service, fixture } = app;
  fixture.sellers.push(seed.seller('s1', 'seller-user-1'));
  seed.user({ id: 'admin1', role: 'ADMIN' });
  seed.user({ id: 'admin2', role: 'ADMIN' });
  seed.order({ id: 'o1', orderNumber: 'EM-10025', items: [{ product: { sellerId: 's1' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'APPROVED' });
  seed.conversation({ id: 'conv1', orderId: 'o1', sellerId: 's1' });

  const msg = await service.sendSellerReply('seller-user-1', 'conv1', 'Yes, available');
  assert.equal(msg.body, 'Yes, available');

  const adminNotifications = fixture.notifications.calls.filter((c) => c.type === 'MESSAGE');
  assert.equal(adminNotifications.length, 2);
  assert.deepEqual(
    adminNotifications.map((n) => n.userId).sort(),
    ['admin1', 'admin2'],
  );
  assert.equal(adminNotifications[0].title, 'New message from ABC Store');
});

test('seller cannot open another seller\'s conversation (404)', async () => {
  const app = makeApp();
  const { seed, service, fixture } = app;
  fixture.sellers.push(seed.seller('s-a', 'seller-a'));
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's-b' } }] });
  seed.profile({ id: 's-b', userId: 'seller-b', storeName: 'Store B', status: 'APPROVED' });
  seed.conversation({ id: 'conv-b', orderId: 'o1', sellerId: 's-b' });
  await assert.rejects(() => service.getSellerConversationMessages('seller-a', 'conv-b'), NotFoundError);
});

test('markRead: only marks messages from the other side, never your own', async () => {
  const app = makeApp();
  const { seed, service } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-1', items: [{ product: { sellerId: 's1' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'APPROVED' });
  seed.conversation({ id: 'conv1', orderId: 'o1', sellerId: 's1' });
  seed.message({ id: 'm1', conversationId: 'conv1', senderUserId: 'seller-user-1', body: 'incoming', readAt: null });
  seed.message({ id: 'm2', conversationId: 'conv1', senderUserId: 'admin1', body: 'own', readAt: null });
  seed.message({ id: 'm3', conversationId: 'conv1', senderUserId: 'seller-user-1', body: 'alread-read', readAt: new Date() });

  const res = await service.markAdminConversationRead('admin1', 'conv1');
  assert.equal(res.updated, 1, 'only the unread incoming message is marked');
});

test('getAdminConversationMessages: enriches sender roles (admin vs seller)', async () => {
  const app = makeApp();
  const { seed, service } = app;
  seed.order({ id: 'o1', orderNumber: 'EM-10025', status: 'PENDING', items: [{ product: { sellerId: 's1' } }] });
  seed.profile({ id: 's1', userId: 'seller-user-1', storeName: 'ABC Store', status: 'APPROVED' });
  seed.user({ id: 'admin1', role: 'ADMIN' });
  seed.user({ id: 'seller-user-1', role: 'CUSTOMER' });
  seed.conversation({ id: 'conv1', orderId: 'o1', sellerId: 's1' });
  seed.message({ id: 'm1', conversationId: 'conv1', senderUserId: 'seller-user-1', body: 'Yes available' });
  seed.message({ id: 'm2', conversationId: 'conv1', senderUserId: 'admin1', body: 'Thanks' });

  const res = await service.getAdminConversationMessages('admin1', 'conv1');
  assert.equal(res.order.orderNumber, 'EM-10025');
  assert.equal(res.seller.storeName, 'ABC Store');
  assert.equal(res.messages[0].senderRole, 'seller');
  assert.equal(res.messages[0].senderName, 'ABC Store');
  assert.equal(res.messages[1].senderRole, 'admin');
  assert.equal(res.messages[1].senderName, 'EMART Admin');
});