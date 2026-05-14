import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, Request, UploadedFile, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Request() req: { user: { id: number } }) {
    return this.usersService.getMe(req.user.id);
  }

  @Get('search')
  async search(@Query('q') q: string) {
    if (!q || q.trim().length < 1) return [];
    return this.usersService.searchUsers(q.trim());
  }

  @Get(':username')
  async getProfile(@Param('username') username: string) {
    return this.usersService.getProfile(username);
  }

  @Get(':username/posts')
  async getUserPosts(@Param('username') username: string) {
    return this.usersService.getUserPosts(username);
  }

  @Get(':username/followers')
  async getFollowers(@Param('username') username: string) {
    return this.usersService.getFollowers(username);
  }

  @Get(':username/following')
  async getFollowing(@Param('username') username: string) {
    return this.usersService.getFollowing(username);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  async updateProfile(
    @Request() req,
    @Body() body: { displayName?: string; bio?: string; avatarUrl?: string },
  ) {
    return this.usersService.updateProfile(req.user.id, body);
  }
}
