import { Post } from './posts.interfaces';

export interface User {
  id: number;
  posts?: Post[];
}
