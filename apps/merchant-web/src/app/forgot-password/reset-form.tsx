"use client";

import { Button, Field } from "@rabbehni/design-system/web";
import { useState, type FormEvent } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function ResetForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`${apiUrl}/v1/auth/password-reset`, {
      body: JSON.stringify({
        email: data.get("email"),
        redirectUri: "http://localhost:3002/auth/callback",
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
        label="E-mail professionnel"
        name="email"
        placeholder="equipe@commerce.com"
        required
        type="email"
      />
      <Button disabled={status === "sending"} type="submit">
        {status === "sending" ? "Envoi…" : "Envoyer les instructions"}
      </Button>
      {status === "sent" && <p role="status">Consultez votre boîte de réception.</p>}
      {status === "error" && <p role="alert">Impossible de contacter le service.</p>}
    </form>
  );
}
