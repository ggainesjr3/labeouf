import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, StrategyOptions } from 'passport-google-oauth20';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    } as StrategyOptions);
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    const googleId = profile.id;
    const displayName = profile.displayName;
    const avatarUrl = profile.photos?.[0]?.value;
    const email = profile.emails?.[0]?.value;

    let user = await this.userRepository.findOne({ where: { googleId } });

    if (!user) {
      const base = (email?.split('@')[0] ?? googleId).replace(/[^a-zA-Z0-9_]/g, '').substring(0, 28);
      const existing = await this.userRepository.findOne({ where: { username: base } });
      const username = existing ? `${base}${googleId.substring(0, 4)}` : base;

      user = this.userRepository.create({
        username,
        displayName,
        avatarUrl,
        googleId,
        passwordHash: '',
      });
      user = await this.userRepository.save(user);
    }

    done(null, user);
  }
}
