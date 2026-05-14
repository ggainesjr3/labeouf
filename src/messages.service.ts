import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async sendMessage(senderId: number, recipientId: number, text: string): Promise<Message> {
    const msg = this.messageRepository.create({ senderId, recipientId, text });
    return this.messageRepository.save(msg);
  }

  async getConversation(userId: number, otherUserId: number): Promise<Message[]> {
    return this.messageRepository
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .leftJoinAndSelect('msg.recipient', 'recipient')
      .where('(msg.senderId = :userId AND msg.recipientId = :otherId) OR (msg.senderId = :otherId AND msg.recipientId = :userId)', { userId, otherId: otherUserId })
      .orderBy('msg.timestamp', 'ASC')
      .getMany();
  }

  async getInbox(userId: number): Promise<any[]> {
    const messages = await this.messageRepository
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .leftJoinAndSelect('msg.recipient', 'recipient')
      .where('msg.senderId = :userId OR msg.recipientId = :userId', { userId })
      .orderBy('msg.timestamp', 'DESC')
      .getMany();

    const seen = new Set();
    const threads: any[] = [];
    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.recipientId : msg.senderId;
      if (!seen.has(otherId)) {
        seen.add(otherId);
        const other = msg.senderId === userId ? msg.recipient : msg.sender;
        threads.push({ user: other, lastMessage: msg });
      }
    }
    return threads;
  }

  async markRead(userId: number, otherUserId: number): Promise<void> {
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ read: true })
      .where('recipientId = :userId AND senderId = :otherUserId', { userId, otherUserId })
      .execute();
  }

  async unreadCount(userId: number): Promise<number> {
    return this.messageRepository.count({ where: { recipientId: userId, read: false } });
  }
}
