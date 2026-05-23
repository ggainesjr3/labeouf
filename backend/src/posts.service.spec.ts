import { PostsService } from './posts.service';

describe('PostsService', () => {
  const postRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  let likeRepository: Record<string, unknown>;
  let followRepository: Record<string, unknown>;
  let replyRepository: Record<string, unknown>;
  let repostRepository: Record<string, unknown>;
  let bookmarkRepository: Record<string, unknown>;
  const moderationLogService = {
    logModeration: jest.fn(),
  };
  const pushService = {
    sendLikeNotification: jest.fn(),
    sendFollowNotification: jest.fn(),
  };

  let service: PostsService;

  beforeEach(() => {
    jest.clearAllMocks();
    likeRepository = {};
    followRepository = {};
    replyRepository = {};
    repostRepository = {};
    bookmarkRepository = {};
    service = new PostsService(
      postRepository as any,
      likeRepository as any,
      followRepository as any,
      replyRepository as any,
      repostRepository as any,
      bookmarkRepository as any,
      moderationLogService as any,
      pushService as any,
    );
    jest.spyOn(service, 'moderateText').mockResolvedValue(undefined);
  });

  it('persists imageUrl and videoUrl when creating a post', async () => {
    const audit = { label: 'NEUTRAL', score: 0.8 };
    const entity = {
      authorId: 7,
      text: 'post with media',
      auditMetadata: audit,
      imageUrl: '/uploads/image.png',
      videoUrl: '/uploads/video.webm',
    };
    postRepository.create.mockReturnValue(entity);
    postRepository.save.mockResolvedValue({ id: 11, ...entity });

    await expect(
      service.createPost(
        7,
        'post with media',
        audit,
        '/uploads/image.png',
        '/uploads/video.webm',
      ),
    ).resolves.toEqual({ id: 11, ...entity });

    expect(service.moderateText).toHaveBeenCalledWith(
      'post with media',
      expect.objectContaining({
        creatorUserId: 7,
        contentType: 'post',
        contentId: expect.any(String),
      }),
    );
    expect(postRepository.create).toHaveBeenCalledWith(entity);
    expect(postRepository.save).toHaveBeenCalledWith(entity);
  });

  it('stores null media URLs when omitted', async () => {
    const audit = { label: 'NEUTRAL', score: 0.8 };
    const entity = {
      authorId: 7,
      text: 'plain post',
      auditMetadata: audit,
      imageUrl: null,
      videoUrl: null,
    };
    postRepository.create.mockReturnValue(entity);
    postRepository.save.mockResolvedValue({ id: 12, ...entity });

    await service.createPost(7, 'plain post', audit);

    expect(postRepository.create).toHaveBeenCalledWith(entity);
  });

  it('annotates feed posts with viewer interaction state', async () => {
    const posts = [
      { id: 1, text: 'liked' },
      { id: 2, text: 'reposted' },
      { id: 3, text: 'bookmarked' },
    ];
    const makeQuery = (rows: Array<{ postId: number }>) => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    });
    const likeQuery = makeQuery([{ postId: 1 }]);
    const repostQuery = makeQuery([{ postId: 2 }]);
    const bookmarkQuery = makeQuery([{ postId: 3 }]);
    (service as any).likeRepository.createQueryBuilder = jest.fn(() => likeQuery);
    (service as any).repostRepository.createQueryBuilder = jest.fn(() => repostQuery);
    (service as any).bookmarkRepository.createQueryBuilder = jest.fn(() => bookmarkQuery);

    await expect((service as any).withViewerState(posts, 9)).resolves.toEqual([
      { id: 1, text: 'liked', isLiked: true, isReposted: false, isBookmarked: false },
      { id: 2, text: 'reposted', isLiked: false, isReposted: true, isBookmarked: false },
      { id: 3, text: 'bookmarked', isLiked: false, isReposted: false, isBookmarked: true },
    ]);
  });

  it('sends a push notification when liking a post', async () => {
    const post = { id: 3, authorId: 8, likeCount: 0 };
    postRepository.findOne.mockResolvedValue(post);
    postRepository.save.mockResolvedValue({ ...post, likeCount: 1 });
    (service as any).likeRepository.findOne = jest.fn().mockResolvedValue(null);
    (service as any).likeRepository.create = jest.fn(data => data);
    (service as any).likeRepository.save = jest.fn().mockResolvedValue({ id: 1 });

    await expect(service.likePost(4, 3)).resolves.toEqual({ liked: true, likeCount: 1 });

    expect(pushService.sendLikeNotification).toHaveBeenCalledWith(8, 4, 3);
  });

  it('sends a push notification when following a user', async () => {
    (service as any).followRepository.findOne = jest.fn().mockResolvedValue(null);
    (service as any).followRepository.create = jest.fn(data => data);
    (service as any).followRepository.save = jest.fn().mockResolvedValue({ id: 1 });

    await expect(service.followUser(4, 8)).resolves.toEqual({ following: true });

    expect(pushService.sendFollowNotification).toHaveBeenCalledWith(8, 4);
  });
});
