import { SearchService } from './search.service';

describe('SearchService', () => {
  const userRepository = { find: jest.fn() };
  const postRepository = {
    createQueryBuilder: jest.fn(),
  };

  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchService(userRepository as any, postRepository as any);
  });

  it('returns empty results for blank query', async () => {
    await expect(service.search('   ')).resolves.toEqual({ users: [], posts: [] });
    expect(userRepository.find).not.toHaveBeenCalled();
  });

  it('searches users and posts', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 1, text: 'hello' }]),
    };
    postRepository.createQueryBuilder.mockReturnValue(qb);
    userRepository.find.mockResolvedValue([{ id: 2, username: 'alice' }]);

    const result = await service.search('ali');
    expect(result.users).toHaveLength(1);
    expect(result.posts).toHaveLength(1);
    expect(userRepository.find).toHaveBeenCalled();
    expect(qb.where).toHaveBeenCalledWith('post.text ILIKE :pattern', { pattern: '%ali%' });
  });
});
