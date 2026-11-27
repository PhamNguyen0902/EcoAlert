import { userRepository } from "../repositories/user.repository";
import { tokenService } from "./token.service";
import { redisClient } from "../config/redis.config";
import { envConfig } from "../config/env.config";
import { RegisterDto, LoginDto } from "../dtos/auth.dto";
import {
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  BadRequestError,
  NotFoundError,
  IUserPayload,
  UserRole,
} from "@ecoalert/shared";
import { hashPassword, comparePassword } from "../utils/password.util";
import { cognitoService } from "./cognito.service";

export class AuthService {
  // Đăng ký người dùng mới qua AWS Cognito (Cognito tự gửi mã OTP 6 số về email)
  async register(data: RegisterDto) {
    const normalizedEmail = data.email.toLowerCase().trim();
    const existingUser = await userRepository.findOne({ email: normalizedEmail, includeDeleted: true });
    if (existingUser && !existingUser.isDeleted && existingUser.isVerified) {
      throw new ConflictError("Email này đã được đăng ký và kích hoạt. Vui lòng đăng nhập.");
    }
    if (existingUser && existingUser.isDeleted) {
      await userRepository.delete(existingUser._id.toString());
    }

    const { firstName, lastName, fullName: inputFullName } = data;
    const fullName = inputFullName || `${firstName || ''} ${lastName || ''}`.trim() || normalizedEmail.split('@')[0];

    // 1. Đăng ký tài khoản trên AWS Cognito
    let wasUnconfirmed = false;
    try {
      await cognitoService.signUp(data.email, data.password, fullName);
    } catch (err: any) {
      if (err.name === "UsernameExistsException") {
        // Tài khoản đã tồn tại trên Cognito: kiểm tra xem có phải chưa xác thực không
        try {
          await cognitoService.resendConfirmationCode(data.email);
          wasUnconfirmed = true;
        } catch (resendErr: any) {
          throw new ConflictError("Email này đã được đăng ký và kích hoạt. Vui lòng đăng nhập.");
        }
      } else if (err.name === "InvalidPasswordException") {
        throw new BadRequestError(
          "Mật khẩu không đạt yêu cầu: cần tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt."
        );
      } else if (err.name === "InvalidParameterException" && err.message?.toLowerCase().includes("password")) {
        throw new BadRequestError(
          "Mật khẩu không hợp lệ: cần tối thiểu 8 ký tự, gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt."
        );
      } else {
        throw new BadRequestError(err.message || "Không thể đăng ký với dịch vụ Cognito.");
      }
    }

    // 2. Lưu bản ghi người dùng vào MongoDB để các microservice EcoAlert sử dụng
    const hashedPassword = await hashPassword(data.password);
    let user = await userRepository.findOne({ email: normalizedEmail });
    if (!user) {
      user = await userRepository.create({
        email: normalizedEmail,
        phone: data.phone,
        fullName,
        password: hashedPassword,
        role: UserRole.CITIZEN,
        isVerified: false,
      });
    } else if (user.isVerified) {
      throw new ConflictError("Email này đã được đăng ký và kích hoạt. Vui lòng đăng nhập.");
    } else {
      // Giữ nguyên mật khẩu và họ tên gốc cho tài khoản chưa kích hoạt để tránh bị chiếm đoạt khi đăng ký lại.
      if (user.isVerified !== false) {
        user.isVerified = false;
        await user.save();
      }
    }

    const userObj = user.toObject();
    delete userObj.password;

    return {
      user: userObj,
      isVerified: false,
      requiresOtp: true,
      email: user.email,
      message: wasUnconfirmed
        ? "Tài khoản của bạn chưa được kích hoạt. Mã OTP 6 số mới đã được gửi lại tới email."
        : "Mã OTP 6 số đã được gửi tới email của bạn. Vui lòng nhập mã để kích hoạt tài khoản.",
    };
  }

  // Xác thực mã OTP 6 chữ số qua AWS Cognito
  async confirmOtp(email: string, code: string) {
    if (!email || !code) {
      throw new BadRequestError("Vui lòng nhập đầy đủ email và mã OTP");
    }

    try {
      await cognitoService.confirmSignUp(email, code.trim());
    } catch (err: any) {
      if (err.name === "CodeMismatchException") {
        throw new BadRequestError("Mã xác thực OTP không chính xác. Vui lòng kiểm tra lại.");
      }
      if (err.name === "ExpiredCodeException") {
        throw new BadRequestError("Mã xác thực OTP đã hết hạn. Vui lòng bấm 'Gửi lại mã'.");
      }
      if (err.name === "NotAuthorizedException" && err.message?.includes("already confirmed")) {
        // Tài khoản đã được xác nhận trước đó
      } else {
        throw new BadRequestError(err.message || "Xác thực mã OTP thất bại.");
      }
    }

    // Cập nhật trạng thái trong MongoDB
    const user = await userRepository.findOne({ email });
    if (user) {
      user.isVerified = true;
      await user.save();
    }

    return {
      success: true,
      email,
      message: "Kích hoạt tài khoản thành công! Bạn có thể đăng nhập ngay bây giờ.",
    };
  }

  // Gửi lại mã OTP 6 số qua AWS Cognito
  async resendOtp(email: string) {
    if (!email) {
      throw new BadRequestError("Vui lòng cung cấp địa chỉ email");
    }

    try {
      await cognitoService.resendConfirmationCode(email);
    } catch (err: any) {
      if (err.name === "UserNotFoundException") {
        throw new NotFoundError("Không tìm thấy tài khoản với email này.");
      }
      throw new BadRequestError(err.message || "Không thể gửi lại mã OTP.");
    }

    return {
      success: true,
      email,
      message: "Mã OTP 6 số mới đã được gửi tới email của bạn. Vui lòng kiểm tra hòm thư.",
    };
  }

  // Đăng nhập người dùng - kiểm tra isVerified
  async login(data: LoginDto) {
    const user = await userRepository.findOneWithPassword({
      email: data.email,
    });
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

    if (!user.isVerified) {
      throw new ForbiddenError(
        "Tài khoản chưa được kích hoạt. Vui lòng xác thực mã OTP gửi về email trước khi đăng nhập."
      );
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

  // Đổi mới access token bằng refresh token (xoay token nguyên tử tránh reuse)
  async refreshToken(oldRefreshToken: string) {
    const tokenDoc = await tokenService.consumeRefreshToken(oldRefreshToken);
    if (!tokenDoc) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const user = await userRepository.findById(tokenDoc.userId.toString());
    if (!user || !user.isActive) {
      throw new UnauthorizedError("User not found or inactive");
    }

    if (!user.isVerified) {
      throw new ForbiddenError("Tài khoản chưa được kích hoạt");
    }

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
