import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User } from './user.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { NotificationService } from './notification.service';

const APP_URL =
  process.env.FRONTEND_URL?.replace(/\/$/, '') ||
  'https://superb-patience-production-3fab.up.railway.app';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PasswordResetToken)
    private resetTokenRepository: Repository<PasswordResetToken>,
    private jwtService: JwtService,
    private notificationService: NotificationService,
  ) {}

  private userPayload(user: User) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      email: user.email,
    };
  }

  async register(email: string, username: string, password: string, displayName?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    const existingEmail = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const existingUsername = await this.userRepository.findOne({ where: { username: normalizedUsername } });
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.userRepository.create({
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      displayName: displayName?.trim() || normalizedUsername,
    });

    const saved = await this.userRepository.save(user);
    const token = this.jwtService.sign({ sub: saved.id, username: saved.username });

    return { token, user: this.userPayload(saved) };
  }

  /** Legacy username login — kept for existing accounts */
  async loginWithUsername(username: string, password: string) {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return { token, user: this.userPayload(user) };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return { token, user: this.userPayload(user) };
  }

  async forgotPassword(email: string): Promise<{ ok: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });

    if (user) {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await this.resetTokenRepository.delete({ userId: user.id });
      await this.resetTokenRepository.save(
        this.resetTokenRepository.create({ userId: user.id, token, expiresAt }),
      );

      const resetUrl = `${APP_URL}/?reset=${token}`;
      await this.notificationService.sendPlainEmail(
        user.email!,
        'Reset your LaBeouf password',
        `We received a request to reset your password.\n\nReset link (valid 1 hour):\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      );
    }

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token?.trim() || !newPassword || newPassword.length < 8) {
      throw new BadRequestException('Invalid reset request');
    }

    const record = await this.resetTokenRepository.findOne({
      where: { token: token.trim(), expiresAt: MoreThan(new Date()) },
    });

    if (!record) {
      throw new BadRequestException('Reset link is invalid or expired');
    }

    const user = await this.userRepository.findOne({ where: { id: record.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.save(user);
    await this.resetTokenRepository.delete({ userId: user.id });

    const jwt = this.jwtService.sign({ sub: user.id, username: user.username });
    return { token: jwt, user: this.userPayload(user) };
  }
}
