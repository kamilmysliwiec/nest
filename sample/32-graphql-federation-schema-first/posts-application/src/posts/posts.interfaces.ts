import { Directive, Field, ID, Int, ObjectType } from '@nestjs/graphql';

export interface Post {
  id: number;
  title: string;
  authorId: number;
}
