// Auth Helper - Token generation and auth utilities for tests
import jwt from 'jsonwebtoken';
import type { Sequelize } from 'sequelize';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-ci-only-32chars!!';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-for-ci-only-32chars';
const JWT_EXPIRES_IN = '15m';
const JWT_REFRESH_EXPIRES_IN = '7d';

export interface TokenPayload {
  userId: number;
  email: string;
  role: string;
  roleId: number;
  branchId?: number;
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

/**
 * Generate both tokens
 */
export function generateTokens(payload: TokenPayload): { accessToken: string; refreshToken: string } {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Create auth headers for tests
 */
export function createAuthHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Create auth headers from user object
 */
export function createAuthHeadersFromUser(user: any): Record<string, string> {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role?.slug || 'employee',
    roleId: user.roleId,
    branchId: user.branchId,
  };
  const { accessToken } = generateTokens(payload);
  return createAuthHeaders(accessToken);
}

/**
 * Create test tokens for different roles
 */
export function createRoleTokens(db: any) {
  return {
    admin: async () => {
      const user = await db.models.User.findOne({ 
        where: { email: 'admin@test.com' },
        include: [{ model: db.models.Role, as: 'role' }]
      });
      if (!user) throw new Error('Admin user not found');
      return generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role?.slug || 'admin',
        roleId: user.roleId,
      });
    },
    cashier: async () => {
      const user = await db.models.User.findOne({ 
        where: { email: 'cashier@test.com' },
        include: [{ model: db.models.Role, as: 'role' }]
      });
      if (!user) throw new Error('Cashier user not found');
      return generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role?.slug || 'cashier',
        roleId: user.roleId,
      });
    },
    hr: async () => {
      const user = await db.models.User.findOne({ 
        where: { email: 'hr@test.com' },
        include: [{ model: db.models.Role, as: 'role' }]
      });
      if (!user) throw new Error('HR user not found');
      return generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role?.slug || 'hr',
        roleId: user.roleId,
      });
    },
    employee: async () => {
      const user = await db.models.User.findOne({ 
        where: { email: 'employee@test.com' },
        include: [{ model: db.models.Role, as: 'role' }]
      });
      if (!user) throw new Error('Employee user not found');
      return generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role?.slug || 'employee',
        roleId: user.roleId,
      });
    },
    inventory: async () => {
      const user = await db.models.User.findOne({ 
        where: { email: 'inventory@test.com' },
        include: [{ model: db.models.Role, as: 'role' }]
      });
      if (!user) throw new Error('Inventory user not found');
      return generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role?.slug || 'inventory_staff',
        roleId: user.roleId,
      });
    },
  };
}

/**
 * Decode token without verification (for testing)
 */
export function decodeToken(token: string): any {
  return jwt.decode(token);
}

/**
 * Create expired token (for testing expiry handling)
 */
export function createExpiredToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '-1h' });
}

/**
 * Create token with custom expiry
 */
export function createTokenWithExpiry(payload: TokenPayload, expiresIn: string): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}