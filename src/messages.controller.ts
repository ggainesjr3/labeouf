import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MessagesService } from './messages.service';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('inbox')
  @UseGuards(AuthGuard('jwt'))
  async getInbox(@Request() req) {
    return this.messagesService.getInbox(req.user.id);
  }

  @Get('unread')
  @UseGuards(AuthGuard('jwt'))
  async unreadCount(@Request() req) {
    return { count: await this.messagesService.unreadCount(req.user.id) };
  }

  @Get(':userId')
  @UseGuards(AuthGuard('jwt'))
  async getConversation(@Request() req, @Param('userId') userId: string) {
    await this.messagesService.markRead(req.user.id, parseInt(userId, 10));
    return this.messagesService.getConversation(req.user.id, parseInt(userId, 10));
  }

  @Post(':userId')
  @UseGuards(AuthGuard('jwt'))
  async sendMessage(@Request() req, @Param('userId') userId: string, @Body() body: { text: string }) {
    return this.messagesService.sendMessage(req.user.id, parseInt(userId, 10), body.text);
  }
}
