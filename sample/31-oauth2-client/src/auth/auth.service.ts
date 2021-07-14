import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
    googleLogin(req) {
        if (!req.user) {
          return 'No user from Google'
        }
        return {
          message: 'User Info from Google',
          user: req.user
        }
      }
    
}
