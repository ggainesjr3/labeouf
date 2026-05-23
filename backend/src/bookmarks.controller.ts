import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookmarksService } from './bookmarks.service';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post(':postId')
  @UseGuards(AuthGuard('jwt'))
  async addBookmark(@Request() req, @Param('postId') postId: string) {
    return this.bookmarksService.addBookmark(req.user.id, parseInt(postId, 10));
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getBookmarks(@Request() req) {
    return this.bookmarksService.getBookmarks(req.user.id);
  }
}
