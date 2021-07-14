import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PostsService],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get all posts for an author', () => {
    const result = service.forAuthor(1);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorId: 1,
        }),
      ]),
    );
  });

  it('should get a single post using the id', () => {
    const result = service.findOne(1);
    expect(result.id).toEqual(1);
  });

  it('should get all posts', () => {
    const result = service.all();
    expect(result.length).toEqual(service['posts'].length);
  });
});
