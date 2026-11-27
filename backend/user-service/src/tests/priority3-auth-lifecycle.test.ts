import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  AppError,
  createLogger,
  internalServiceRequest,
  safeJsonStringify,
  UnauthorizedError,
  UserRole,
} from '@ecoalert/shared';
import { authService } from '../services/auth.service';
import { tokenService } from '../services/token.service';
import { userService } from '../services/user.service';
import { userRepository } from '../repositories/user.repository';
import { refreshTokenRepository } from '../repositories/refresh-token.repository';
import { User } from '../models/user.model';
import { redisClient } from '../config/redis.config';

test.after(() => {
  redisClient.disconnect();
});

test('safeJsonStringify and createLogger handle circular metadata and Error instances safely', () => {
  const circular: Record<string, unknown> = { ok: true };
  circular.self = circular;
  const err = new Error('boom');
  (err as unknown as Record<string, unknown>).circular = circular;

  const serialized = safeJsonStringify({ circular, err, big: BigInt(42) });
  assert.match(serialized, /"\[Circular\]"/);
  assert.match(serialized, /"message":"boom"/);
  assert.match(serialized, /"big":"42"/);

  const logger = createLogger('test-logger');
  logger.silent = true;
  assert.doesNotThrow(() => {
    logger.error('Circular error test', { err, circular });
  });
});

test('internalServiceRequest preserves 4xx/503 without retry, retries 500 once, and signs prefixed paths', async () => {
  const prevSecret = process.env.SERVICE_AUTH_SECRET;
  process.env.SERVICE_AUTH_SECRET = 'test-internal-service-secret-key-32';

  let calls = 0;
  let mode: '400' | '503' | '500-then-200' = '400';
  let observedUrl = '';

  const server = http.createServer((req, res) => {
    calls += 1;
    observedUrl = req.url || '';
    if (mode === '400') {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Bad payload' }));
      return;
    }
    if (mode === '503') {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Service warming up' }));
      return;
    }
    if (mode === '500-then-200' && calls === 1) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Transient error' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: { ok: true } }));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as { port: number }).port;
    const base = `http://127.0.0.1:${port}/internal-prefix`;

    // 1. 400 is preserved without retry
    calls = 0;
    mode = '400';
    await assert.rejects(
      () => internalServiceRequest(base, '/verify', 'alert-service', undefined),
      (err: unknown) => err instanceof AppError && err.statusCode === 400 && err.message === 'Bad payload',
    );
    assert.equal(calls, 1);
    assert.equal(observedUrl, '/internal-prefix/verify');

    // 2. 503 is preserved without retry
    calls = 0;
    mode = '503';
    await assert.rejects(
      () => internalServiceRequest(base, '/verify', 'alert-service', { x: 1 }),
      (err: unknown) => err instanceof AppError && err.statusCode === 503 && err.message === 'Service warming up',
    );
    assert.equal(calls, 1);

    // 3. Transient 500 is retried once and succeeds
    calls = 0;
    mode = '500-then-200';
    const data = await internalServiceRequest<{ ok: boolean }>(base, '/verify', 'alert-service', { x: 1 });
    assert.deepEqual(data, { ok: true });
    assert.equal(calls, 2);

    // 4. Unconfigured secret fails immediately with 503 before fetch
    process.env.SERVICE_AUTH_SECRET = 'short';
    const prevJwt = process.env.JWT_SECRET;
    process.env.JWT_SECRET = '';
    try {
      calls = 0;
      await assert.rejects(
        () => internalServiceRequest(base, '/verify', 'alert-service', {}),
        (err: unknown) => err instanceof AppError && err.statusCode === 503,
      );
      assert.equal(calls, 0);
    } finally {
      if (prevJwt === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevJwt;
    }
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevSecret === undefined) delete process.env.SERVICE_AUTH_SECRET;
    else process.env.SERVICE_AUTH_SECRET = prevSecret;
  }
});

test('AuthService.refreshToken consumes refresh token atomically so replay fails', async () => {
  const origConsumeByToken = refreshTokenRepository.consumeByToken.bind(refreshTokenRepository);
  const origFindById = userRepository.findById.bind(userRepository);
  const origGenerateAuthTokens = tokenService.generateAuthTokens.bind(tokenService);

  let consumed = false;
  refreshTokenRepository.consumeByToken = (async (token: string) => {
    if (token !== 'rt-1' || consumed) return null;
    consumed = true;
    return {
      token: 'rt-1',
      userId: '507f1f77bcf86cd799439011',
      expiresAt: new Date(Date.now() + 60_000),
    } as any;
  }) as any;
  userRepository.findById = (async () => ({
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    email: 'citizen@example.com',
    role: UserRole.CITIZEN,
    isActive: true,
    isVerified: true,
  })) as any;
  tokenService.generateAuthTokens = (async () => ({
    accessToken: 'at-2',
    refreshToken: 'rt-2',
  })) as any;

  try {
    const first = await authService.refreshToken('rt-1');
    assert.equal(first.accessToken, 'at-2');
    assert.equal(first.refreshToken, 'rt-2');

    await assert.rejects(
      () => authService.refreshToken('rt-1'),
      (err: unknown) => err instanceof UnauthorizedError,
    );
  } finally {
    refreshTokenRepository.consumeByToken = origConsumeByToken;
    userRepository.findById = origFindById;
    tokenService.generateAuthTokens = origGenerateAuthTokens;
  }
});

test('UserService revokes all refresh tokens on password, role, deactivation, and delete changes', async () => {
  const origFindByIdWithPassword = userRepository.findByIdWithPassword.bind(userRepository);
  const origFindById = userRepository.findById.bind(userRepository);
  const origUpdate = userRepository.update.bind(userRepository);
  const origDelete = userRepository.delete.bind(userRepository);
  const origDeleteAllForUser = refreshTokenRepository.deleteAllForUser.bind(refreshTokenRepository);

  const revokedFor: string[] = [];
  refreshTokenRepository.deleteAllForUser = (async (userId: string) => {
    revokedFor.push(userId);
    return true;
  }) as any;

  userRepository.findByIdWithPassword = (async (id: string) => ({
    _id: id,
    password: '$2b$10$invalidhashfortestonly',
  })) as any;
  userRepository.findById = (async (id: string) => ({
    _id: id,
    email: 'target@example.com',
    role: UserRole.CITIZEN,
    isActive: true,
  })) as any;
  userRepository.update = (async (id: string, data: any) => ({
    _id: id,
    email: 'target@example.com',
    ...data,
  })) as any;
  userRepository.delete = (async () => true) as any;

  try {
    await userService.changeRole('admin-1', 'user-1', 'officer');
    await userService.toggleStatus('admin-1', 'user-2', false);
    await userService.toggleStatus('admin-1', 'user-3', true);
    await userService.deleteUser('admin-1', 'user-4');
    await userService.softDelete('admin-1', 'user-5');

    assert.deepEqual(revokedFor, ['user-1', 'user-2', 'user-4', 'user-5']);
  } finally {
    userRepository.findByIdWithPassword = origFindByIdWithPassword;
    userRepository.findById = origFindById;
    userRepository.update = origUpdate;
    userRepository.delete = origDelete;
    refreshTokenRepository.deleteAllForUser = origDeleteAllForUser;
  }
});

test('UserRepository.delete uses User.deleteOne (bypasses pre-find isDeleted filter) and getUsers supports isDeleted=true', async () => {
  const origDeleteOne = User.deleteOne;
  const origFindPaginated = userRepository.findPaginated.bind(userRepository);

  let deleteOneFilter: unknown = null;
  (User as any).deleteOne = async (filter: unknown) => {
    deleteOneFilter = filter;
    return { deletedCount: 1 };
  };

  let capturedFilter: Record<string, unknown> | null = null;
  userRepository.findPaginated = (async (filter: any) => {
    capturedFilter = filter;
    return { items: [], total: 0 };
  }) as any;

  try {
    const deleted = await userRepository.delete('507f1f77bcf86cd799439055');
    assert.equal(deleted, true);
    assert.deepEqual(deleteOneFilter, { _id: '507f1f77bcf86cd799439055' });

    await userService.getUsers(1, 10, undefined, undefined, 'true');
    const finalFilter = capturedFilter as Record<string, unknown> | null;
    assert.equal(finalFilter?.isDeleted, true);
    assert.equal(finalFilter?.includeDeleted, true);
  } finally {
    (User as any).deleteOne = origDeleteOne;
    userRepository.findPaginated = origFindPaginated;
  }
});
