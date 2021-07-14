import { Injectable } from '@nestjs/common';
import { Post } from './posts.interfaces';

@Injectable()
export class PostsService {
  private posts: Post[] = [
    { authorId: 1, id: 1, title: 'Lorem Ipsum' },
    { authorId: 1, id: 2, title: 'Foo' },
    { authorId: 2, id: 3, title: 'Bar' },
    { authorId: 2, id: 4, title: 'Hello World' },
  ];

  forAuthor(authorId: number) {
    return this.posts.filter((post) => post.authorId === Number(authorId));
  }

  findOne(postId: number) {
    return this.posts.find((post) => post.id === postId);
  }

  all() {
    return this.posts;
  }
}
