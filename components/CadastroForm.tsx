"use client";

import { useState } from "react";

interface CadastroFormProps {
  onSubmit: (dados: { nome: string; telefone: string; email: string; placa: string; cidade: string }) => void;
  plano: string;
  valor: string;
  loading?: boolean;
}

const PLATE_RE = /^[A-Z]{3}[-\s]?(?:\d[A-Z]\d{2}|\d{4})$/i;

const inputStyle: React.CSSProperties = {
  backgroundColor: "#0d1117",
  border: "1px solid #0066ff44",
  borderRadius: 8,
  color: "#ffffff",
  padding: "10px 14px",
  width: "100%",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  color: "#aaaaaa",
  fontSize: 12,
  marginBottom: 4,
  display: "block",
};

const errorStyle: React.CSSProperties = {
  color: "#ef4444",
  fontSize: 11,
  marginTop: 3,
};

export default function CadastroForm({ onSubmit, plano, valor, loading = false }: CadastroFormProps) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [placa, setPlaca] = useState("");
  const [cidade, setCidade] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = "Nome obrigatório";
    if (!telefone.trim()) errs.telefone = "WhatsApp obrigatório";
    if (!email.trim()) errs.email = "Email obrigatório";
    if (!placa.trim()) errs.placa = "Placa obrigatória";
    else if (!PLATE_RE.test(placa.replace(/\s/g, ""))) errs.placa = "Formato inválido (ex: ABC1234 ou ABC1D23)";
    if (!cidade.trim()) errs.cidade = "Cidade obrigatória";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSubmit({
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email.trim(),
      placa: placa.trim().toUpperCase().replace(/\s/g, ""),
      cidade: cidade.trim(),
    });
  }

  function field(
    label: string,
    key: keyof typeof errors,
    value: string,
    setValue: (v: string) => void,
    extra?: React.InputHTMLAttributes<HTMLInputElement>
  ) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        <input
          value={value}
          onChange={e => { setValue(e.target.value); setErrors(p => ({ ...p, [key]: "" })); }}
          style={{
            ...inputStyle,
            borderColor: errors[key] ? "#ef4444" : "#0066ff44",
          }}
          disabled={loading}
          {...extra}
        />
        {errors[key] && <p style={errorStyle}>{errors[key]}</p>}
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: "#0a0a0f",
      border: "1px solid #0066ff",
      borderRadius: 12,
      padding: "16px 18px",
      width: "100%",
    }}>
      <p style={{ color: "#0066ff", fontWeight: 700, fontSize: 12, marginBottom: 2, textTransform: "uppercase", letterSpacing: 1 }}>
        Clube K-RRO
      </p>
      <p style={{ color: "#ffffff", fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
        Cadastro — {plano} · {valor}
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {field("Nome completo", "nome", nome, setNome, { type: "text", placeholder: "João da Silva" })}
        {field("WhatsApp com DDD", "telefone", telefone, setTelefone, { type: "tel", placeholder: "51 99999-8888" })}
        {field("Email", "email", email, setEmail, { type: "email", placeholder: "joao@email.com" })}
        {field("Placa do veículo", "placa", placa, (v) => setPlaca(v.toUpperCase()), {
          type: "text",
          placeholder: "ABC1D23",
          maxLength: 8,
        })}
        {field("Cidade", "cidade", cidade, setCidade, { type: "text", placeholder: "Porto Alegre" })}
        <button
          type="submit"
          disabled={loading}
          style={{
            backgroundColor: "#0066ff",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "12px 0",
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            marginTop: 4,
            width: "100%",
          }}
        >
          {loading ? "Processando…" : "Confirmar cadastro"}
        </button>
      </form>
    </div>
  );
}
