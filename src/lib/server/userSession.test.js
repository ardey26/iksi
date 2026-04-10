import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.SECRET_KEY = 'test-secret-key-that-is-32-chars!';

// Mock prisma
vi.mock('$lib/prisma.js', () => ({
  prisma: {
    session: {
      create: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

const { prisma } = await import('$lib/prisma.js');
const { createUserSession, verifyUserSession, deleteUserSession } = await import('./auth.js');

describe('createUserSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a session in DB and returns a signed token', async () => {
    prisma.session.create.mockResolvedValue({ id: 'sess_123' });

    const token = await createUserSession('user_abc');

    expect(prisma.session.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_abc',
        expiresAt: expect.any(Date)
      })
    });

    // Token format: sessionId.signature
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe('sess_123');
  });
});

describe('verifyUserSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user for valid, non-expired session', async () => {
    const mockUser = { id: 'user_abc', email: 'test@example.com' };
    prisma.session.findFirst.mockResolvedValue({
      id: 'sess_123',
      user: mockUser
    });

    // We need a validly signed token for sess_123
    const { createUserSession } = await import('./auth.js');
    prisma.session.create.mockResolvedValue({ id: 'sess_123' });
    const token = await createUserSession('user_abc');

    prisma.session.findFirst.mockResolvedValue({
      id: 'sess_123',
      user: mockUser
    });

    const user = await verifyUserSession(token);
    expect(user).toEqual(mockUser);
    expect(prisma.session.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'sess_123',
        expiresAt: { gt: expect.any(Date) }
      },
      select: { id: true, user: true }
    });
  });

  it('returns null for invalid token format', async () => {
    const user = await verifyUserSession('garbage');
    expect(user).toBeNull();
  });

  it('returns null for tampered signature', async () => {
    const user = await verifyUserSession('sess_123.badsignature');
    expect(user).toBeNull();
  });

  it('returns null for expired/missing session', async () => {
    prisma.session.create.mockResolvedValue({ id: 'sess_old' });
    const token = await createUserSession('user_abc');

    prisma.session.findFirst.mockResolvedValue(null);
    const user = await verifyUserSession(token);
    expect(user).toBeNull();
  });
});

describe('deleteUserSession', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes session by id', async () => {
    prisma.session.deleteMany.mockResolvedValue({ count: 1 });
    await deleteUserSession('sess_123');
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { id: 'sess_123' }
    });
  });
});
