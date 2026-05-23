import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { PostsService } from './posts.service';
import { BrainService } from './brain.service';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly brainService: BrainService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createPost(@Request() req, @Body() body: { text: string; imageUrl?: string; videoUrl?: string }) {
    const auditResult = await this.brainService.analyze(body.text);
    return this.postsService.createPost(req.user.id, body.text, auditResult, body.imageUrl, body.videoUrl);
  }

  @Get('feed')
  @UseGuards(AuthGuard('jwt'))
  async getFeed(@Request() req) {
    return this.postsService.getFeed(req.user.id);
  }

  @Get('public')
  async getPublicFeed() {
    return this.postsService.getPublicFeed();
  }

  @Get('hashtag/:tag')
  async getPostsByHashtag(@Param('tag') tag: string) {
    return this.postsService.getPostsByHashtag(tag);
  }

  @Get('trending')
  async getTrending() {
    return this.postsService.getTrendingPosts();
  }

  @Post(':id/like')
  @UseGuards(AuthGuard('jwt'))
  async likePost(@Request() req, @Param('id') id: string) {
    return this.postsService.likePost(req.user.id, parseInt(id, 10));
  }

  @Post(':id/repost')
  @UseGuards(AuthGuard('jwt'))
  async repostPost(@Request() req, @Param('id') id: string) {
    return this.postsService.repostPost(req.user.id, parseInt(id, 10));
  }

  @Get(':id/replies')
  async getReplies(@Param('id') id: string) {
    return this.postsService.getReplies(parseInt(id, 10));
  }

  @Post(':id/replies')
  @UseGuards(AuthGuard('jwt'))
  async createReply(@Request() req, @Param('id') id: string, @Body() body: { text: string }) {
    const auditResult = await this.brainService.analyze(body.text);
    return this.postsService.createReply(req.user.id, parseInt(id, 10), body.text, auditResult);
  }


  @Delete('replies/:replyId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteReplyAdmin(@Param('replyId', ParseIntPipe) replyId: number) {
    await this.postsService.deleteReplyByIdAdmin(replyId);
    return { ok: true };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deletePostAdmin(@Param('id', ParseIntPipe) id: number) {
    await this.postsService.deletePostByIdAdmin(id);
    return { ok: true };
  }
  @Post('follow/:id')
  @UseGuards(AuthGuard('jwt'))
  async followUser(@Request() req, @Param('id') id: string) {
    return this.postsService.followUser(req.user.id, parseInt(id, 10));
  }
}
