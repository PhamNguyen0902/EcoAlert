import { RefreshToken, IRefreshToken } from '../models/refresh-token.model';

export class RefreshTokenRepository {
  async create(data: Partial<IRefreshToken>): Promise<IRefreshToken> {
    const token = new RefreshToken(data);
    return token.save();
  }

  async findByToken(token: string): Promise<IRefreshToken | null> {
    return RefreshToken.findOne({ token });
  }

  async deleteByToken(token: string): Promise<boolean> {
    const result = await RefreshToken.findOneAndDelete({ token });
    return !!result;
  }

  async deleteAllForUser(userId: string): Promise<boolean> {
    const result = await RefreshToken.deleteMany({ userId });
    return result.acknowledged;
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
