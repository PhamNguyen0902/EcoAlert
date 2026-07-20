import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLogin } from "../hooks/hooks";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Leaf } from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

export default function Login() {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          localStorage.setItem("token", data.data.token);
          localStorage.setItem("refreshToken", data.data.refreshToken);
          localStorage.setItem("user", JSON.stringify(data.data.user));
          toast.success("Successfully logged in");
          navigate("/dashboard");
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || "Login failed");
        },
      },
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm lg:w-96"
        >
          <div>
            <div className="flex items-center gap-2 font-bold text-2xl text-primary">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-sm">
                <Leaf size={24} />
              </div>
              EcoAlert
            </div>
            <h2 className="mt-8 text-2xl font-bold leading-9 tracking-tight text-gray-900">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              Not a member?{" "}
              <Link
                to="/register"
                className="font-semibold text-primary hover:text-primary/80"
              >
                Register now
              </Link>
            </p>
          </div>

          <div className="mt-10">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <Label htmlFor="email">Email address</Label>
                <div className="mt-2">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="exmaple@gmail.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="mt-2">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
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
            Protecting our environment, together.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-6 text-xl max-w-xl text-green-50"
          >
            EcoAlert leverages AI and real-time GIS to instantly classify and
            route environmental incidents to the right authorities.
          </motion.p>
        </div>
      </div>
    </div>
  );
}
