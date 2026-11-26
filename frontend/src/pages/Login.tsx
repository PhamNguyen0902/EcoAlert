import { useEffect, useState } from "react";
import axios from "axios";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useConfirmOtp, useLogin, useResendOtp } from "../hooks/hooks";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Leaf, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getRoleHome } from "../lib/routes";
import { getApiErrorMessage } from "../lib/api-error";

import { ThemeToggle } from "../components/ui/theme-toggle";
import { useLanguage } from "../contexts/LanguageContext";
//trang login
export default function Login() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const loginMutation = useLogin();
  const confirmOtpMutation = useConfirmOtp();
  const resendOtpMutation = useResendOtp();
  const { login, isAuthenticated, role } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsOtp, setNeedsOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  if (isAuthenticated && role) {
    const targetPath = getRoleHome(role);
    if (targetPath) {
      return <Navigate to={targetPath} replace />;
    }
  }
  // xử lý login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    loginMutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: (data) => {
          const loginData = data.data;

          toast.success(t("toast.login_success"), { duration: 2000 });

          login({
            token: loginData.token || loginData.accessToken,
            refreshToken: loginData.refreshToken,
            user: loginData.user,
          });
          //chủ động chuyển hướng sau khi đăng nhập thành công
          const userRole = loginData.user?.role;
          const target = getRoleHome(userRole);
          navigate(target, { replace: true });
        },
        onError: (err: unknown) => {
          const msg = getApiErrorMessage(err, "Email hoặc mật khẩu không chính xác.");
          setErrorMessage(msg);
          toast.error(msg);
          if (axios.isAxiosError(err) && err.response?.status === 403) {
            setNeedsOtp(true);
          }
        },
      },
    );
  };

  const handleConfirmOtp = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedOtp = otpCode.trim();
    if (!cleanedOtp) {
      toast.error("Vui lòng nhập mã OTP.");
      return;
    }
    confirmOtpMutation.mutate(
      { email: email.trim(), code: cleanedOtp },
      {
        onSuccess: (data: any) => {
          toast.success(
            data?.message || data?.data?.message || "Kích hoạt tài khoản thành công!",
          );
          setNeedsOtp(false);
          setOtpCode("");
          setErrorMessage(null);
        },
        onError: (err: unknown) => {
          const msg = getApiErrorMessage(err, "Xác thực mã OTP thất bại.");
          setErrorMessage(msg);
          toast.error(msg);
        },
      },
    );
  };

  const handleResendOtp = () => {
    const trimmed = email.trim();
    if (!trimmed || resendCooldown > 0 || resendOtpMutation.isPending) return;
    resendOtpMutation.mutate(
      { email: trimmed },
      {
        onSuccess: (data: any) => {
          toast.success(
            data?.message || data?.data?.message || "Đã gửi lại mã OTP tới email của bạn.",
          );
          setResendCooldown(30);
        },
        onError: (err: unknown) => {
          toast.error(getApiErrorMessage(err, "Không thể gửi lại mã OTP."));
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-2xl text-primary">
                <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
                  <Leaf size={24} />
                </div>
                EcoAlert
              </div>
              <ThemeToggle />
            </div>
            <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-foreground">
              {t("auth.login_title")}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t("auth.no_account")}{" "}
              <Link
                to="/register"
                className="font-semibold text-primary hover:text-primary/80"
              >
                {t("nav.signup")}
              </Link>
            </p>
          </div>

          <div className="mt-10">
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            )}

            {needsOtp && (
              <form onSubmit={handleConfirmOtp} className="mb-6 space-y-4 rounded-lg border border-border bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">
                  Tài khoản chưa kích hoạt. Nhập mã OTP đã gửi tới{' '}
                  <span className="font-semibold text-foreground">{email.trim()}</span>.
                </p>
                <div>
                  <Label htmlFor="loginOtpCode">Mã xác thực OTP</Label>
                  <Input
                    id="loginOtpCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Nhập 6 chữ số OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                    className="mt-1.5"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={confirmOtpMutation.isPending || otpCode.trim().length < 4}
                  >
                    {confirmOtpMutation.isPending ? "Đang xác thực..." : "Kích hoạt"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={resendCooldown > 0 || resendOtpMutation.isPending}
                    onClick={handleResendOtp}
                  >
                    {resendCooldown > 0 ? `Gửi lại (${resendCooldown}s)` : "Gửi lại OTP"}
                  </Button>
                </div>
              </form>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <Label htmlFor="email">{t("auth.email")}</Label>
                <div className="mt-2">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="example@gmail.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">{t("auth.password")}</Label>
                <div className="mt-2 relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none transition-colors"
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "..." : t("nav.signin")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="relative hidden w-0 flex-1 lg:block bg-green-900">
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-multiply"
          src="https://images.unsplash.com/photo-1473448912268-2022ce9509d8?q=80&w=2041&auto=format&fit=crop"
          alt="Forest background"
        />
        <div className="absolute inset-0 flex flex-col justify-center px-12 text-white">
          <motion.h1
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-5xl font-bold max-w-2xl"
          >
            {t("hero.protecting")} {t("hero.our_environment")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-6 text-xl max-w-xl text-green-50"
          >
            {t("hero.subtitle")}
          </motion.p>
        </div>
      </div>
    </div>
  );
}
