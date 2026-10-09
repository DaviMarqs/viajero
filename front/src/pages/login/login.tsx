import { AuthLayout } from '@/components/ui/auth-layout';
import { Button } from '@/components/ui/button';
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

import { ApiError, apiRequest } from "../../lib/api";
import { login } from "../../lib/auth";
import { useAuth } from "@/contexts/authContext";
import type { TravelerDNAProfile } from "@/lib/profiles";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(1, "Informe sua senha"),
});

type LoginForm = z.infer<typeof loginSchema>;

async function getTravelerDNAProfile(token: string) {
  const response = await apiRequest<{ data?: TravelerDNAProfile | null; }>(
    "/api/traveler-dna/me/",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return response.data ?? null;
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth, sessionExpired } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setSubmitError(null);

    try {
      const response = await login({
        email: data.email,
        password: data.senha,
      });

      setAuth(response.data);

      const token = response.data.access;
      const profile = await getTravelerDNAProfile(token);

      if (profile) {
        navigate("/", { replace: true });
        return;
      }

      navigate("/onboard", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
        return;
      }

      setSubmitError("Não foi possível entrar agora. Tente novamente.");
    }
  };

  return (
    <AuthLayout title="Sua próxima viagem não terminou." description="Acesse sua conta para continuar seus roteiros, recuperar preferências e deixe a IA montar a próxima experiência com contexto real." storySide="left">

      <div className="mx-auto w-full max-w-md">
        <div className="mb-10 space-y-3">
          <h1 className="page-title">
            Bem-vindo de volta
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Entre com seu email e senha para continuar.
          </p>
        </div>

        {sessionExpired && !submitError && (
          <div role="status" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Sua sessão expirou. Entre novamente para continuar.
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-strong"
              htmlFor="email"
            >
              Email
            </label>
            <div className="form-control-shell">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <input
                id="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                autoComplete="email"
                type="email"
                placeholder="você@exemplo.com"
                className="h-full w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p id="email-error" role="alert" className="text-sm text-destructive">{errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-strong"
              htmlFor="senha"
            >
              Senha
            </label>
            <div className="form-control-shell">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <input
                id="senha"
                aria-invalid={!!errors.senha}
                aria-describedby={errors.senha ? "senha-error" : undefined}
                autoComplete="current-password"
                type={showPassword ? "text" : "password"}
                placeholder="Digite sua senha"
                className="h-full w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                {...register("senha")}
              />
              <button
                type="button"
                className="flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-strong"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword ? "Ocultar senha" : "Mostrar senha"
                }
              >
                {showPassword ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.senha && (
              <p id="senha-error" role="alert" className="text-sm text-destructive">{errors.senha.message}
              </p>
            )}
          </div>

          {submitError && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {submitError}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
            {isSubmitting ? "Entrando..." : "Fazer login"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center">
          <Link
            to="/register"
            className="text-sm font-medium text-strong transition hover:text-foreground"
          >
            Criar uma conta nova
          </Link>
        </div>
      </div>

    </AuthLayout>
  );
}
