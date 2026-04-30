import { FormEvent, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { viajeroApi } from "../api/viajero";
import { FormField, HomeIndicator, IconChevronLeft, IconHeart, IconUser, MobilePage, PrimaryButton } from "../components/ui/ViajeroUI";

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const parsedName = useMemo(() => {
    const [firstName = "", ...rest] = fullName.trim().split(/\s+/);
    return { firstName, lastName: rest.join(" ") };
  }, [fullName]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("As senhas precisam ser iguais.");
      return;
    }

    try {
      await viajeroApi.register({
        email,
        password,
        username: email.split("@")[0] || fullName.replace(/\s+/g, "").toLowerCase(),
        display_name: fullName,
        first_name: parsedName.firstName,
        last_name: parsedName.lastName,
      });
      navigate("/profile");
    } catch {
      setError("Não foi possível criar sua conta.");
    }
  }

  return (
    <MobilePage>
      <div className="top-actions">
        <NavLink className="back-link" to="/login">
          <IconChevronLeft size={20} />
          <span>Voltar</span>
        </NavLink>
      </div>
      <div className="screen-heading">
        <h2>Informações</h2>
        <p className="screen-subtitle">Junte-se agora a milhares de viajantes</p>
      </div>
      <form className="form-grid" onSubmit={onSubmit}>
        <FormField label="Nome completo" required icon={<IconUser size={20} />}>
          <input placeholder="Insira seu nome completo" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </FormField>
        <FormField label="Email" required icon={<span>@</span>}>
          <input placeholder="felipe@kenzo.com" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </FormField>
        <FormField label="Senha" required icon={<IconHeart size={20} />}>
          <input placeholder="********" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </FormField>
        <FormField label="Confirmar senha" required icon={<IconHeart size={20} />}>
          <input placeholder="********" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </FormField>
        {error ? <p className="error-text">{error}</p> : null}
        <PrimaryButton type="submit">Próximo passo</PrimaryButton>
      </form>
      <HomeIndicator />
    </MobilePage>
  );
}
