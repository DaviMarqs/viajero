import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, UserRound } from "lucide-react";

import { ApiError } from "../../lib/api";
import { isAuthenticated, register as registerRequest } from "../../lib/auth";

const registerSchema = z
  .object({
    nome: z.string().min(1, "Nome e obrigatorio"),
    email: z.string().email("Email invalido"),
    senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    confirmar: z.string().min(1, "Confirme sua senha"),
    termos: z.boolean().refine((value) => value === true, {
      message: "Voce deve aceitar os termos",
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
      await registerRequest({
        email: data.email,
        password: data.senha,
        display_name: data.nome.trim(),
        first_name: firstName,
        last_name: lastName,
      });

      navigate("/onboard", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message);
        return;
      }

      setSubmitError("Nao foi possivel criar a conta agora. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(46,140,255,0.18),_transparent_36%),linear-gradient(180deg,#f7f9fc_0%,#eef4fb_100%)] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-7xl overflow-hidden rounded-[32px] bg-white shadow-[0_24px_120px_rgba(15,23,42,0.12)] lg:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-10 space-y-3">
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                Cadastro
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Crie sua conta
              </h1>
              <p className="text-sm leading-6 text-slate-500 sm:text-base">
                Configure seu acesso para salvar preferencias e montar roteiros personalizados.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="nome">
                  Nome completo
                </label>
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-sky-500 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(46,140,255,0.12)]">
                  <UserRound className="h-5 w-5 text-slate-400" />
                  <input
                    id="nome"
                    type="text"
                    placeholder="Seu nome completo"
                    className="h-full w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    {...register("nome")}
                  />
                </div>
                {errors.nome && <p className="text-sm text-red-500">{errors.nome.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="email">
                  Email
                </label>
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-sky-500 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(46,140,255,0.12)]">
                  <Mail className="h-5 w-5 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    className="h-full w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    {...register("email")}
                  />
                </div>
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="senha">
                  Senha
                </label>
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-sky-500 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(46,140,255,0.12)]">
                  <Lock className="h-5 w-5 text-slate-400" />
                  <input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="Crie uma senha"
                    className="h-full w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    {...register("senha")}
                  />
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-slate-700"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
                {errors.senha && <p className="text-sm text-red-500">{errors.senha.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="confirmar">
                  Confirmar senha
                </label>
                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-sky-500 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(46,140,255,0.12)]">
                  <Lock className="h-5 w-5 text-slate-400" />
                  <input
                    id="confirmar"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repita a senha"
                    className="h-full w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    {...register("confirmar")}
                  />
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-slate-700"
                    onClick={() => setShowConfirm((current) => !current)}
                    aria-label={showConfirm ? "Ocultar confirmacao" : "Mostrar confirmacao"}
                  >
                    {showConfirm ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                  </button>
                </div>
                {errors.confirmar && <p className="text-sm text-red-500">{errors.confirmar.message}</p>}
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <input
                  id="termos"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
                  {...register("termos")}
                />
                <span>
                  Concordo com os <span className="font-medium text-slate-900">termos de privacidade</span>.
                </span>
              </label>
              {errors.termos && <p className="text-sm text-red-500">{errors.termos.message}</p>}

              {submitError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isSubmitting ? "Criando conta..." : "Criar conta"}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center">
              <Link to="/" className="text-sm font-medium text-slate-600 transition hover:text-slate-950">
                Fazer login
              </Link>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-[280px] flex-col justify-end overflow-hidden bg-[linear-gradient(160deg,#2e8cff_0%,#1553c6_45%,#0c2f73_100%)] p-8 text-white sm:p-10 lg:min-h-full lg:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.18),_transparent_26%)]" />
          <div className="absolute -right-12 top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-56 w-56 -translate-x-1/4 translate-y-1/4 rounded-full bg-cyan-300/20 blur-3xl" />

          <div className="relative z-10 max-w-xl space-y-4">
            <h2 className="max-w-lg text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Seu proximo destino comeca aqui.
            </h2>
            <p className="max-w-xl text-base leading-7 text-white/72 sm:text-lg">
              Crie a conta, configure seu perfil de viagem e deixe o Viajero usar esse
              contexto para recomendar experiencias com mais precisao.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
