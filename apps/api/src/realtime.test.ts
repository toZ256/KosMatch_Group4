import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, login, type TestContext } from './test/helpers';

let ctx: TestContext;
const sockets: Socket[] = [];
beforeAll(async () => {
  ctx = await createTestContext();
});
afterEach(() => {
  while (sockets.length) sockets.pop()?.disconnect();
});
afterAll(async () => {
  await ctx.close();
});

const open = (token?: string): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const s = connect(ctx.url, { auth: token ? { token } : {}, reconnection: false, transports: ['websocket'] });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(e));
  });

const once = <T>(s: Socket, event: string) => new Promise<T>((resolve) => s.once(event, resolve));

describe('bookmarks API', () => {
  it('is idempotent, isolated per user, returns full Kos and tolerates missing deletes', async () => {
    const t1 = await login(ctx, 'tenant@kosmatch.test');
    const t2 = await login(ctx, 'tenant2@kosmatch.test');
    const kos = (await ctx.api.get('/api/kos')).body.data as { id: string; namaKos: string }[];
    const target = kos[5]!;

    const h1 = { Authorization: `Bearer ${t1.token}` };
    const h2 = { Authorization: `Bearer ${t2.token}` };
    const before = (await ctx.api.get('/api/bookmarks').set(h1)).body.data.length as number;
    expect((await ctx.api.post('/api/bookmarks').set(h1).send({ kosId: target.id })).status).toBe(201);
    await ctx.api.post('/api/bookmarks').set(h1).send({ kosId: target.id });
    const list = (await ctx.api.get('/api/bookmarks').set(h1)).body.data as { id: string; namaKos: string }[];
    expect(list).toHaveLength(before + 1);
    expect(list.find((k) => k.id === target.id)?.namaKos).toBe(target.namaKos);

    expect((await ctx.api.get('/api/bookmarks').set(h2)).body.data).toHaveLength(0);
    expect((await ctx.api.delete(`/api/bookmarks/${target.id}`).set(h2)).status).toBe(200);
    expect((await ctx.api.get('/api/bookmarks').set(h1)).body.data).toHaveLength(before + 1);

    expect((await ctx.api.delete(`/api/bookmarks/${target.id}`).set(h1)).status).toBe(200);
    expect((await ctx.api.delete(`/api/bookmarks/${target.id}`).set(h1)).status).toBe(200);
    expect((await ctx.api.get('/api/bookmarks').set(h1)).body.data).toHaveLength(before);
    expect((await ctx.api.post('/api/bookmarks').set(h1).send({ kosId: 'nope' })).status).toBe(404);
  });
});

describe('chat REST', () => {
  it('lists conversations and history, and accepts REST sends', async () => {
    const t = await login(ctx, 'tenant@kosmatch.test');
    const o = await login(ctx, 'owner@kosmatch.test');
    const h = { Authorization: `Bearer ${t.token}` };
    const convs = (await ctx.api.get('/api/chats/conversations').set(h)).body.data;
    expect(convs[0].otherUser.id).toBe(o.id);
    expect(convs[0].otherUser.passwordHash).toBeUndefined();
    const history = (await ctx.api.get(`/api/chats/${o.id}`).set(h)).body.data;
    expect(history).toHaveLength(3);
    const sent = await ctx.api.post(`/api/chats/${o.id}`).set(h).send({ pesan: 'via REST' });
    expect(sent.status).toBe(201);
    expect((await ctx.api.post(`/api/chats/${o.id}`).set(h).send({ pesan: '' })).status).toBe(400);
    expect((await ctx.api.post(`/api/chats/${t.id}`).set(h).send({ pesan: 'diri' })).status).toBe(400);
    expect((await ctx.api.get('/api/chats/unknown').set(h)).status).toBe(404);
    expect((await ctx.api.get('/api/chats/conversations')).status).toBe(401);
  });
});

describe('Socket.IO chat', () => {
  it('rejects sockets without a valid token', async () => {
    await expect(open()).rejects.toThrow('UNAUTHORIZED');
    await expect(open('garbage')).rejects.toThrow('UNAUTHORIZED');
  });

  it('delivers messages both ways to receiver and sender (multi-tab) and persists them', async () => {
    const t = await login(ctx, 'tenant@kosmatch.test');
    const o = await login(ctx, 'owner@kosmatch.test');
    const tenantA = await open(t.token);
    const tenantB = await open(t.token);
    const owner = await open(o.token);

    const ownerGot = once<{ pesan: string; senderId: string }>(owner, 'message:new');
    const tenantBGot = once<{ pesan: string }>(tenantB, 'message:new');
    const ack = await tenantA.emitWithAck('message:send', { receiverId: o.id, pesan: 'Halo owner' });
    expect(ack.ok).toBe(true);
    expect((await ownerGot).pesan).toBe('Halo owner');
    expect((await tenantBGot).pesan).toBe('Halo owner');

    const tenantGot = once<{ pesan: string; senderId: string }>(tenantA, 'message:new');
    await owner.emitWithAck('message:send', { receiverId: t.id, pesan: 'Halo penyewa' });
    const reply = await tenantGot;
    expect(reply).toMatchObject({ pesan: 'Halo penyewa', senderId: o.id });

    const stored = await ctx.repo.chats.between(t.id, o.id);
    expect(stored.map((m) => m.pesan)).toEqual(expect.arrayContaining(['Halo owner', 'Halo penyewa']));
  });

  it('validates message length via ack', async () => {
    const t = await login(ctx, 'tenant@kosmatch.test');
    const o = await login(ctx, 'owner@kosmatch.test');
    const s = await open(t.token);
    expect((await s.emitWithAck('message:send', { receiverId: o.id, pesan: '' })).ok).toBe(false);
    expect((await s.emitWithAck('message:send', { receiverId: o.id, pesan: 'x'.repeat(1001) })).ok).toBe(false);
    expect((await s.emitWithAck('message:send', { receiverId: o.id, pesan: 'x'.repeat(1000) })).ok).toBe(true);
  });
});
