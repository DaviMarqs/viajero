import { AuthLayout } from '@/components/ui/auth-layout';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";

import { ApiError } from "../../lib/api";
import { isAuthenticated, register as registerRequest } from "../../lib/auth";
import { useAuth } from "@/contexts/authContext";

const registerSchema = z
  .object({
    nome: z.string().min(1, "Nome é obrigatório"),
    email: z.string().email("Email inválido"),
    senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    confirmar: z.string().min(1, "Confirme sua senha"),
    termos: z.boolean().refine((value) => value === true, {
      message: "você deve aceitar os termos",
    }),
  })
  .refine((data) => data.senha === data.confirmar, {
    message: "As senhas nao coincidem",
    path: ["confirmar"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
}

export default function Register() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      termos: true,
    },
  });

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/onboard", { replace: true });
    }
  }, [navigate]);

  const onSubmit = async (data: RegisterForm) => {
    setSubmitError(null);
    const { firstName, lastName } = splitName(data.nome);

    try {
      const response = await registerRequest({
        email: data.email,
        password: data.senha,
        display_name: data.nome.trim(),
        first_name: firstName,
        last_name: lastName,
      });

      setAuth(response.data);
      navigate("/onboard", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
        return;
      }

      setSubmitError("Não foi possível criar a conta agora. Tente novamente.");
    }
  };

  return (
    <AuthLayout title="Seu próximo destino começa aqui." description="Crie a conta, configure seu perfil de viagem e deixe o Viajero usar esse contexto para recomendar experiências com mais precisão." storySide="right">

      <div className="mx-auto w-full max-w-md">
        <div className="mb-10 space-y-3">
          <h1 className="page-title">
            Crie sua conta
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Configure seu acesso para salvar preferências e montar roteiros
            personalizados.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-strong"
              htmlFor="nome"
            >
              Nome completo
            </label>
            <div className="form-control-shell">
              <UserRound className="h-5 w-5 text-muted-foreground" />
              <input
                id="nome"
                aria-invalid={!!errors.nome}
                aria-describedby={errors.nome ? "nome-error" : undefined}
                autoComplete="name"
                type="text"
                placeholder="Seu nome completo"
                className="h-full w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                {...register("nome")}
              />
            </div>
            {errors.nome && (
              <p id="nome-error" role="alert" className="text-sm text-destructive">{errors.nome.message}
              </p>
            )}
          </div>

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
                autoComplete="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Crie uma senha"
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

          <div className="space-y-2">
            <label
              className="text-sm font-medium text-strong"
              htmlFor="confirmar"
            >
              Confirmar senha
            </label>
            <div className="form-control-shell">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <input
                id="confirmar"
                aria-invalid={!!errors.confirmar}
                aria-describedby={errors.confirmar ? "confirmar-error" : undefined}
                autoComplete="new-password"
                type={showConfirm ? "text" : "password"}
                placeholder="Repita a senha"
                className="h-full w-full border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                {...register("confirmar")}
              />
              <button
                type="button"
                className="flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-strong"
                onClick={() => setShowConfirm((current) => !current)}
                aria-label={
                  showConfirm
                    ? "Ocultar confirmacao"
                    : "Mostrar confirmacao"
                }
              >
                {showConfirm ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
            </div>
            {errors.confirmar && (
              <p className="text-sm text-red-500">
                {errors.confirmar.message}
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-strong">
            <input
              id="termos"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-foreground focus:ring-slate-400"
              {...register("termos")}
            />
            <span>
              Concordo com os{" "}
              <span className="font-medium text-foreground">
                termos de privacidade
              </span>
              .
            </span>
          </label>
          {errors.termos && (
            <p className="text-sm text-red-500">{errors.termos.message}
            </p>
          )}

          {submitError && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {submitError}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
            {isSubmitting ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center">
          <Link
            to="/login"
            className="text-sm font-medium text-strong transition hover:text-foreground"
          >
            Fazer login
          </Link>
        </div>
      </div>

    </AuthLayout>
  );
}
