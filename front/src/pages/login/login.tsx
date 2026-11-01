import { AuthLayout } from '@/components/ui/auth-layout';
import { Button } from '@/components/ui/button';
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

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
    <AuthLayout title="Sua viagem continua aqui." description="Retome seus roteiros e encontre novas experiências com o seu jeito de viajar." login>

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
          <div role="status" className="mb-5 rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-ink-muted">
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground"
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
              </Button>
            </div>
            {errors.senha && (
              <p id="senha-error" role="alert" className="text-sm text-destructive">{errors.senha.message}
              </p>
            )}
          </div>

          {submitError && (
            <div role="alert" className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm text-ink-muted">
              {submitError}
            </div>
          )}

          <Button type="submit" loading={isSubmitting} size="lg" className="w-full">
            Fazer login
          </Button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">Ainda não tem conta?</span>
          <Link
            to="/register"
            className="font-medium text-primary hover:underline"
          >
            Criar conta
          </Link>
        </div>
      </div>

    </AuthLayout>
  );
}
