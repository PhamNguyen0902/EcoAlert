import { userRepository } from "../repositories/user.repository";
import { tokenService } from "./token.service";
import { RegisterDto, LoginDto } from "../dtos/auth.dto";
import {
  ConflictError,
  UnauthorizedError,
  IUserPayload,
  UserRole,
} from "@ecoalert/shared";
import { hashPassword, comparePassword } from "../utils/password.util";

export class AuthService {
  async register(data: RegisterDto) {
    const existingUser = await userRepository.findOne({ email: data.email });
    if (existingUser) {
      throw new ConflictError("Email already in use");
    }

    const hashedPassword = await hashPassword(data.password);
    const user = await userRepository.create({
      ...data,
      password: hashedPassword,
      role: UserRole.CITIZEN,
    });

    const payload: IUserPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role as UserRole,
    };

    const tokens = await tokenService.generateAuthTokens(payload);
    const userObj = user.toObject();
    delete userObj.password;

    return { user: userObj, ...tokens, token: tokens.accessToken };
  }

  async login(data: LoginDto) {
    const user = await userRepository.findOneWithPassword({
      email: data.email,
    });
    console.log(
      "DEBUG - user found:",
      user
        ? {
            email: user.email,
            hasPassword: !!user.password,
            isActive: user.isActive,
          }
        : null,
    );
    if (!user || !user.password) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account is deactivated");
    }

    const isMatch = await comparePassword(data.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid credentials");
    }

    const payload: IUserPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role as UserRole,
    };

    const tokens = await tokenService.generateAuthTokens(payload);
    const userObj = user.toObject();
    delete userObj.password;

    return { user: userObj, ...tokens, token: tokens.accessToken };
  }

  async refreshToken(oldRefreshToken: string) {
    const tokenDoc = await tokenService.verifyRefreshToken(oldRefreshToken);
    if (!tokenDoc) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const user = await userRepository.findById(tokenDoc.userId.toString());
    if (!user || !user.isActive) {
      throw new UnauthorizedError("User not found or inactive");
    }

    await tokenService.deleteRefreshToken(oldRefreshToken);

    const payload: IUserPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role as UserRole,
    };

    const tokens = await tokenService.generateAuthTokens(payload);
    return { ...tokens, token: tokens.accessToken };
  }
}

export const authService = new AuthService();
