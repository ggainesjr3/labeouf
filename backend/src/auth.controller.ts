import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Req, Res, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Controller('auth')
@Throttle({ default: { limit: 5, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(
    @Body() body: { email: string; username: string; password: string; displayName?: string },
  ) {
    return this.authService.register(body.email, body.username, body.password, body.displayName);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email?: string; username?: string; password: string }) {
    if (body.email) {
      return this.authService.login(body.email, body.password);
    }
    if (body.username) {
      return this.authService.loginWithUsername(body.username, body.password);
    }
    throw new BadRequestException('Email or username required');
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res() res) {
    const user = req.user;
    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    const userData = encodeURIComponent(JSON.stringify({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
    }));
    const frontendUrl =
      process.env.FRONTEND_URL ??
      process.env.ALLOWED_ORIGIN?.split(',')[0]?.trim();
    if (!frontendUrl) {
      throw new Error('FRONTEND_URL or ALLOWED_ORIGIN must be set for Google OAuth redirect');
    }
    res.redirect(`${frontendUrl}/?token=${token}&user=${userData}`);
  }
}
