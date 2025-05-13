import { IUser } from '../../models/user'; // Adjust this path to your actual User type

declare global {
  namespace Express {
    interface Request {
      user?: IUser; // or `user: IUser` if it's always present
    }
  }
}