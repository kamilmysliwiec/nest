import { Test, TestingModule } from '@nestjs/testing';
import { Post } from './models/post.model';
import { PostsService } from './posts.service';
import { UsersResolver } from './users.resolver';

const postsServiceMock = {
  forAuthor: jest.fn((authorId: number): Post[] => {
    return [{ authorId, id: 1, title: 'Post Mock' }];
  }),
};

describe('UsersResolver', () => {
  let resolver: UsersResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersResolver,
        { provide: PostsService, useValue: postsServiceMock },
      ],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('should resolve posts of a user', () => {
    const result = resolver.posts({ id: 1 });
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorId: 1,
        }),
      ]),
    );
  });
});
