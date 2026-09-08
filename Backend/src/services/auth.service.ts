import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../config/database';
import config from '../config/env';
import { ConflictError, UnauthorizedError, NotFoundError, BadRequestError } from '../utils/errors';
import { generateToken } from '../utils/jwt';

const SALT_ROUNDS = 12;
const googleClient = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

export class AuthService {
  async register(data: { email: string; password: string; firstName?: string; lastName?: string }) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('An account with this email already exists. Please login or use a different email.');
    }

    // Hash password with higher salt rounds for better security
    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        password: hashedPassword,
        firstName: data.firstName?.trim() || null,
        lastName: data.lastName?.trim() || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    // Create cart and wallet for user
    await Promise.all([
      prisma.cart.create({
        data: {
          userId: user.id,
        },
      }),
      prisma.wallet.create({
        data: {
          userId: user.id,
          balance: 0,
          currency: 'USD',
        },
      }),
    ]);

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { user, token };
  }

  async login(email: string, password: string) {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password. Please check your credentials and try again.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password. Please check your credentials and try again.');
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    return { user: userWithoutPassword, token };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found. Your session may have expired.');
    }

    return user;
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; phone?: string }) {
    // Validate that at least one field is being updated
    if (!data.firstName && !data.lastName && !data.phone) {
      throw new BadRequestError('Please provide at least one field to update.');
    }

    const updateData: any = {};
    
    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName.trim() || null;
    }
    
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName.trim() || null;
    }
    
    if (data.phone !== undefined) {
      updateData.phone = data.phone.trim() || null;
    }

    return await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found. Your session may have expired.');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect. Please try again.');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return true;
  }

  async refreshToken(userId: string) {
    // Get user to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found. Please login again.');
    }

    // Generate new JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return { token };
  }

  async getGoogleAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return googleClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  async googleCallback(code: string) {
    try {
      // Exchange code for tokens
      const { tokens } = await googleClient.getToken(code);
      googleClient.setCredentials(tokens);

      // Get user info from Google
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.google.clientId,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        throw new BadRequestError('Failed to get user information from Google');
      }

      const { email, given_name, family_name, sub: googleId } = payload;

      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
        },
      });

      // If user doesn't exist, create new user
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            password: await bcrypt.hash(googleId, SALT_ROUNDS), // Use Google ID as password (they won't use it)
            firstName: given_name || null,
            lastName: family_name || null,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
          },
        });

        // Create cart and wallet for new user
        await Promise.all([
          prisma.cart.create({
            data: {
              userId: user.id,
            },
          }),
          prisma.wallet.create({
            data: {
              userId: user.id,
              balance: 0,
              currency: 'USD',
            },
          }),
        ]);
      }

      // Generate JWT token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return { user, token };
    } catch (error) {
      console.error('Google OAuth error:', error);
      throw new UnauthorizedError('Failed to authenticate with Google. Please try again.');
    }
  }
}

export default new AuthService();
