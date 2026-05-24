import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller()
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Post('admin/promote')
  @HttpCode(HttpStatus.OK)
  async promote(@Body() body: { username?: string; secret?: string }) {
    const expected = process.env.ADMIN_PROMOTE_SECRET;
    if (!expected) {
      throw new BadRequestException('ADMIN_PROMOTE_SECRET is not configured on the server');
    }
    if (!body.secret || body.secret !== expected) {
      throw new ForbiddenException('Invalid promote secret');
    }
    if (!body.username?.trim()) {
      throw new BadRequestException('username is required');
    }
    return this.usersService.promoteToAdmin(body.username.trim());
  }
}
