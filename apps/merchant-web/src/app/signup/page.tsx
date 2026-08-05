import { MerchantSignup } from "@rabbehni/design-system/signup-web";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "إنشاء مساحة عمل" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function MerchantSignupPage() {
  return <MerchantSignup apiUrl={apiUrl} loginHref="/login" />;
}
