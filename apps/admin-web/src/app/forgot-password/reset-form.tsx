"use client";

import { Button, Field } from "@rabbehni/design-system/web";
import { useState, type FormEvent } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const adminUrl = process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? "http://localhost:3001";

export function ResetForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`${apiUrl}/v1/auth/password-reset`, {
      body: JSON.stringify({
        email: form.get("email"),
        redirectUri: `${adminUrl}/auth/callback`,
      }),
      credentials: "include",
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
    setStatus(response?.ok ? "sent" : "error");
  }

  return (
    <form className="r-auth-actions" onSubmit={submit}>
      <Field
        autoComplete="email"
        label="Adresse e-mail"
        name="email"
        placeholder="vous@entreprise.com"
        required
        type="email"
      />
      <Button disabled={status === "sending"} type="submit">
        {status === "sending" ? "Envoi…" : "Recevoir le lien sécurisé"}
      </Button>
      {status === "sent" && (
        <p role="status">Si ce compte existe, les instructions ont été envoyées.</p>
      )}
      {status === "error" && <p role="alert">Le service est temporairement indisponible.</p>}
    </form>
  );
}
