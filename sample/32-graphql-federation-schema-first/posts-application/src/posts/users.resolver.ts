import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { PostsService } from './posts.service';
import { User } from './users.interfaces';

@Resolver('User')
export class UsersResolver {
  constructor(private readonly postsService: PostsService) {}

  @ResolveField('posts')
  public posts(@Parent() user: User) {
    return this.postsService.forAuthor(user.id);
  }
}
