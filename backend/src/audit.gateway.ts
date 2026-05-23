import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({ cors: { origin: '*' } })
export class AuditGateway {
  @WebSocketServer()
  server: Server;

  broadcastAudit(data: any) {
    if (this.server) {
      this.server.emit('audit_event', data);
    }
  }
}
