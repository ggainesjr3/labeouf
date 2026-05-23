import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    healthController = app.get<HealthController>(HealthController);
  });

  describe('check', () => {
    it('returns backend health status', () => {
      expect(healthController.check()).toEqual({
        ok: true,
        service: 'labeouf-backend',
        timestamp: expect.any(String),
      });
    });
  });
});
