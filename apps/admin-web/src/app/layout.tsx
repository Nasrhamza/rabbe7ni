import type { Metadata } from "next";
import type { ReactNode } from "react";

import "bootstrap/dist/css/bootstrap.min.css";
import "@rabbehni/design-system/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Rabbehni Admin",
    template: "%s · Rabbehni Admin",
  },
  description: "Secure administration for the Rabbehni platform",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
