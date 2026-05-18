import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminNotFoundGuard } from './admin-not-found.guard';

function contextForUser(user?: { id: number }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('Admin guards', () => {
  const userRepository = {
    findOne: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AdminGuard', () => {
    it('allows admins', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, role: 'admin' });
      const guard = new AdminGuard(userRepository as any);

      await expect(guard.canActivate(contextForUser({ id: 1 }))).resolves.toBe(true);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('rejects non-admins with 403', async () => {
      userRepository.findOne.mockResolvedValue({ id: 1, role: 'user' });
      const guard = new AdminGuard(userRepository as any);

      await expect(guard.canActivate(contextForUser({ id: 1 }))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects missing users with 403', async () => {
      const guard = new AdminGuard(userRepository as any);

      await expect(guard.canActivate(contextForUser())).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('AdminNotFoundGuard', () => {
    it('allows admins', async () => {
      userRepository.findOne.mockResolvedValue({ id: 2, role: 'admin' });
      const guard = new AdminNotFoundGuard(userRepository as any);

      await expect(guard.canActivate(contextForUser({ id: 2 }))).resolves.toBe(true);
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 2 } });
    });

    it('hides admin-only resources from non-admins with 404', async () => {
      userRepository.findOne.mockResolvedValue({ id: 2, role: 'user' });
      const guard = new AdminNotFoundGuard(userRepository as any);

      await expect(guard.canActivate(contextForUser({ id: 2 }))).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects missing users with 401', async () => {
      const guard = new AdminNotFoundGuard(userRepository as any);

      await expect(guard.canActivate(contextForUser())).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
