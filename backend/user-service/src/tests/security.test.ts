import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@ecoalert/shared';
import { validate } from '../middlewares/validate.middleware';
import { updateProfileSchema, changeRoleSchema, toggleStatusSchema } from '../dtos/user.dto';
import { requireAuth, requireRoles } from '../middlewares/auth.middleware';
import { User } from '../models/user.model';
import { userController } from '../controllers/user.controller';
import { userService } from '../services/user.service';
import { errorHandler } from '../middlewares/error-handler.middleware';
import { redisClient } from '../config/redis.config';

test.after(() => {
  redisClient.disconnect();
});

test('validate middleware strips unknown fields like role=ADMIN from req.body', async () => {
  const middleware = validate(updateProfileSchema);
  const req: any = {
    body: {
      fullName: 'Nguyen Van A',
      role: 'ADMIN',
      isActive: false,
      isVerified: true,
    },
  };
  let nextErr: unknown;
  await middleware(req, {} as any, (err?: unknown) => {
    nextErr = err;
  });
  assert.equal(nextErr, undefined);
  assert.deepEqual(req.body, { fullName: 'Nguyen Van A' });
  assert.equal('role' in req.body, false);
  assert.equal('isActive' in req.body, false);
  assert.equal('isVerified' in req.body, false);
});

test('changeRoleSchema and toggleStatusSchema reject invalid roles and non-boolean status', async () => {
  await assert.rejects(() => changeRoleSchema.parseAsync({ role: 'SUPERADMIN' }));
  const parsedRole = await changeRoleSchema.parseAsync({ role: 'officer' });
  assert.equal(parsedRole.role, UserRole.OFFICER);

  await assert.rejects(() => toggleStatusSchema.parseAsync({ isActive: 'true' }));
  const parsedStatus = await toggleStatusSchema.parseAsync({ isActive: false });
  assert.equal(parsedStatus.isActive, false);
});

test('User schema toJSON and toObject always strip password hash', () => {
  const userDoc = new User({
    email: 'citizen@example.com',
    password: '$2b$10$hashedpasswordvalue',
    fullName: 'Citizen One',
    role: UserRole.CITIZEN,
  });
  const json = userDoc.toJSON() as unknown as Record<string, unknown>;
  const obj = userDoc.toObject() as unknown as Record<string, unknown>;
  assert.equal('password' in json, false);
  assert.equal('password' in obj, false);
  assert.equal(json.email, 'citizen@example.com');
});

test('requireAuth and requireRoles reject spoofed headers without valid JWT and enforce IDOR check on getUserById', async () => {
  const prevSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-user-service-jwt-secret-32chars';

  const app = express();
  app.use(express.json());
  app.get('/users/:id', requireAuth, (req, res, next) => {
    userController.getUserById(req, res).catch(next);
  });
  app.get('/admin-only', requireAuth, requireRoles([UserRole.ADMIN]), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);

  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;
    // 1. Spoofed x-user-id / x-user-role headers without Authorization Bearer JWT must fail with 401
    const spoofAdminRes = await fetch(`${baseUrl}/admin-only`, {
      headers: { 'x-user-id': 'attacker', 'x-user-role': 'ADMIN' },
    });
    assert.equal(spoofAdminRes.status, 401);

    // 2. Valid CITIZEN JWT calling admin-only route fails with 403
    const citizenToken = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: UserRole.CITIZEN },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const forbiddenRes = await fetch(`${baseUrl}/admin-only`, {
      headers: {
        authorization: `Bearer ${citizenToken}`,
        'x-user-role': 'ADMIN',
      },
    });
    assert.equal(forbiddenRes.status, 403);

    // 3. CITIZEN reading another user's profile via GET /users/:id fails with 403 (IDOR closed)
    const idorRes = await fetch(`${baseUrl}/users/507f1f77bcf86cd799439099`, {
      headers: { authorization: `Bearer ${citizenToken}` },
    });
    assert.equal(idorRes.status, 403);

    // 4. Valid ADMIN JWT succeeds
    const adminToken = jwt.sign(
      { userId: '507f1f77bcf86cd799439012', role: UserRole.ADMIN },
      process.env.JWT_SECRET,
      { algorithm: 'HS256' },
    );
    const okRes = await fetch(`${baseUrl}/admin-only`, {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert.equal(okRes.status, 200);
  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  }
});

test('userService blocks self role-change, self status-toggle, and self-deletion', async () => {
  const adminId = '507f1f77bcf86cd799439012';
  await assert.rejects(() => userService.changeRole(adminId, adminId, UserRole.CITIZEN));
  await assert.rejects(() => userService.toggleStatus(adminId, adminId, false));
  await assert.rejects(() => userService.deleteUser(adminId, adminId));
});
