import webpush from 'web-push';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('PushService', () => {
  const subscriptionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };
  const userRepository = {
    findOne: jest.fn(),
  };

  let service: PushService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    service = new PushService(subscriptionRepository as any, userRepository as any);
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('saves browser push subscriptions for the logged-in user', async () => {
    const subscription = {
      endpoint: 'https://push.example/subscription',
      expirationTime: null,
      keys: { p256dh: 'p256dh', auth: 'auth' },
    };
    const entity = { id: 1, userId: 4, endpoint: subscription.endpoint };
    subscriptionRepository.findOne.mockResolvedValue(null);
    subscriptionRepository.create.mockReturnValue(entity);
    subscriptionRepository.save.mockResolvedValue(entity);

    await expect(service.saveSubscription(4, subscription)).resolves.toEqual({ ok: true });

    expect(subscriptionRepository.create).toHaveBeenCalledWith({
      userId: 4,
      endpoint: subscription.endpoint,
      p256dh: 'p256dh',
      auth: 'auth',
      expirationTime: null,
    });
    expect(subscriptionRepository.save).toHaveBeenCalledWith(entity);
  });

  it('sends like notifications to the post author subscriptions', async () => {
    userRepository.findOne.mockResolvedValue({ id: 5, username: 'liker', displayName: 'Liker' });
    subscriptionRepository.find.mockResolvedValue([
      { id: 10, endpoint: 'https://push.example/1', p256dh: 'p256dh', auth: 'auth', expirationTime: null },
    ]);
    (webpush.sendNotification as jest.Mock).mockResolvedValue({});

    await service.sendLikeNotification(9, 5, 42);

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push.example/1' }),
      JSON.stringify({
        title: 'New like',
        body: 'Liker liked your post.',
        data: { type: 'like', postId: 42, actorUserId: 5 },
      }),
    );
  });
});
