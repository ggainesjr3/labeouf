import { PostsService } from './posts.service';

describe('PostsService', () => {
  const postRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const noopRepository = {};
  const moderationLogService = {
    logModeration: jest.fn(),
  };

  let service: PostsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostsService(
      postRepository as any,
      noopRepository as any,
      noopRepository as any,
      noopRepository as any,
      noopRepository as any,
      moderationLogService as any,
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
});
