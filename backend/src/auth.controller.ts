import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(
    @Body() body: { username: string; password: string; displayName?: string },
  ) {
    return this.authService.register(body.username, body.password, body.displayName);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
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
    }));
    const frontendUrl = process.env.FRONTEND_URL ?? process.env.ALLOWED_ORIGIN ?? 'http://localhost:8080';
    res.redirect(`${frontendUrl}/?token=${token}&user=${userData}`);
  }
}
