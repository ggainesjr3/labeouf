import { PostsController } from './posts.controller';

describe('PostsController', () => {
  const postsService = {
    createPost: jest.fn(),
  };
  const brainService = {
    analyze: jest.fn(),
  };

  let controller: PostsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PostsController(postsService as any, brainService as any);
  });

  it('passes optional imageUrl and videoUrl through when creating a post', async () => {
    const audit = { label: 'NEUTRAL', score: 0.9 };
    const created = {
      id: 1,
      text: 'hello media',
      imageUrl: '/uploads/image.webp',
      videoUrl: '/uploads/video.mp4',
    };
    brainService.analyze.mockResolvedValue(audit);
    postsService.createPost.mockResolvedValue(created);

    await expect(
      controller.createPost(
        { user: { id: 42 } },
        {
          text: 'hello media',
          imageUrl: '/uploads/image.webp',
          videoUrl: '/uploads/video.mp4',
        },
      ),
    ).resolves.toBe(created);

    expect(brainService.analyze).toHaveBeenCalledWith('hello media');
    expect(postsService.createPost).toHaveBeenCalledWith(
      42,
      'hello media',
      audit,
      '/uploads/image.webp',
      '/uploads/video.mp4',
    );
  });
});
