import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/**
 * Like AdminGuard but returns 404 for non-admins (authenticated users only;
 * unauthenticated requests fail earlier with 401 from JWT guard).
 */
@Injectable()
export class AdminNotFoundGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: { id: number } }>();
    const jwtUser = req.user;
    if (!jwtUser?.id) {
      throw new UnauthorizedException();
    }
    const user = await this.userRepository.findOne({ where: { id: jwtUser.id } });
    if (user?.role !== 'admin') {
      throw new NotFoundException();
    }
    return true;
  }
}
