const root = "/assets/rabbehni";

export const webAssets = {
  branding: {
    logoDark: `${root}/branding/rabbehni-main-logo.png`,
    logoLight: `${root}/branding/rabbehni-main-logo-light.png`,
  },
  animations: {
    accessBlocked: `${root}/animations/animation-access-blocked-barrier.gif`,
    lightbulb: `${root}/animations/animation-lightbulb.gif`,
  },
  auth: {
    adminLogin: `${root}/auth/auth-login-office-illustration.jpg`,
    collaboration: `${root}/auth/auth-form-collaboration-illustration.png`,
    resetPassword: `${root}/auth/icon-reset-password.png`,
    tabletUser: `${root}/auth/auth-tablet-user.jpg`,
  },
  avatars: {
    customer: `${root}/avatars/default/avatar-male-blue-shirt.jpg`,
    default: `${root}/avatars/default/avatar-user-default-black.jpg`,
    staffFemale: `${root}/avatars/default/avatar-female-bun-pink.jpg`,
    staffMale: `${root}/avatars/default/avatar-male-blue-shirt.jpg`,
  },
  badges: {
    bronze: `${root}/badges/3d/achievement-medal-bronze-3d.png`,
    gold: `${root}/badges/3d/achievement-medal-gold-3d.png`,
    missionComplete: `${root}/badges/badge-mission-complete.png`,
    rankingBronze: `${root}/badges/rankings/ranking-medal-bronze-third.jpg`,
    rankingGold: `${root}/badges/rankings/ranking-medal-gold-first.jpg`,
    rankingSilver: `${root}/badges/rankings/ranking-medal-silver-second.jpg`,
    silver: `${root}/badges/3d/achievement-medal-silver-3d.png`,
  },
  business: {
    agreement: `${root}/business/contract-agreement-handshake.jpg`,
    team: `${root}/team/team-collaboration-office.jpg`,
    workspace: `${root}/workspace/workspace-laptop-mobile.jpg`,
  },
  communication: {
    emailMarketing: `${root}/communication/email-marketing-illustration.jpg`,
    emailNotification: `${root}/communication/email-notification-3d.png`,
  },
  errors: {
    notFound: `${root}/errors/error-404-delivery-illustration.webp`,
    sad: `${root}/states/state-sad-face-orange.png`,
  },
  files: {
    emptySearch: `${root}/states/state-empty-search-question.png`,
    notFound: `${root}/states/state-files-not-found-illustration.jpg`,
    xlsx: `${root}/files/file-format-xlsx.png`,
  },
  gamification: {
    favorite: `${root}/icons/icon-favorite-star-3d.png`,
    reward: `${root}/gamification/icon-reward-gift-box.png`,
    scratch: `${root}/gamification/icon-scratch-card.png`,
    spin: `${root}/gamification/icon-spin-and-win-wheel.png`,
    trophy: `${root}/gamification/icon-win-trophy.png`,
  },
  icons: {
    analytics: `${root}/icons/dashboard/icon-analytics-growth.png`,
    location: `${root}/icons/location/icon-location-pin-red.png`,
    lock: `${root}/icons/security/icon-padlock-outline-white.png`,
    shop: `${root}/icons/commerce/icon-shop-storefront.png`,
    staff: `${root}/icons/users/icon-staff-member-outline-white.png`,
  },
  languages: {
    en: `${root}/languages/language-english-uk-flag.png`,
    fr: `${root}/languages/language-french-flag.png`,
  },
  merchants: {
    atlasFit: `${root}/merchants/merchant-atlas-fit.jpg`,
    cafeMedina: `${root}/merchants/merchant-cafe-medina.jpg`,
    darElBey: `${root}/merchants/merchant-dar-el-bey.jpg`,
    jasminSpa: `${root}/merchants/merchant-jasmin-spa.jpg`,
    maisonJasmin: `${root}/merchants/merchant-maison-jasmin.jpg`,
    medinaMarket: `${root}/merchants/merchant-medina-market.jpg`,
  },
  productivity: {
    schedule: `${root}/productivity/productivity-clock-notebooks.jpg`,
  },
  security: {
    account: `${root}/security/account-security-laptop-illustration.jpg`,
    mobileProtection: `${root}/security/mobile-account-protection-illustration.png`,
    secureLogin: `${root}/security/secure-login-mobile-illustration.jpg`,
  },
  support: {
    agent: `${root}/support/customer-support-agent-illustration.jpg`,
    assistant: `${root}/support/support-agent-3d.png`,
    availability: `${root}/support/support-team-24-7.png`,
  },
} as const;

export function merchantPhotoFor(value: unknown): WebAssetPath {
  const normalized = String(value ?? "")
    .trim()
    .toLocaleLowerCase()
    .replaceAll("_", "-");
  if (normalized.includes("atlas-fit")) return webAssets.merchants.atlasFit;
  if (
    normalized.includes("jasmin-spa") ||
    normalized.includes("blue-lagoon") ||
    normalized.includes("zenith-well")
  )
    return webAssets.merchants.jasminSpa;
  if (normalized.includes("maison-jasmin")) return webAssets.merchants.maisonJasmin;
  if (normalized.includes("dar-el-bey")) return webAssets.merchants.darElBey;
  if (normalized.includes("medina-market") || normalized.includes("north-coast"))
    return webAssets.merchants.medinaMarket;
  return webAssets.merchants.cafeMedina;
}

type ValueOf<T> = T[keyof T];
type AssetGroup = ValueOf<typeof webAssets>;
export type WebAssetPath = AssetGroup extends infer Group
  ? Group extends Record<string, string>
    ? ValueOf<Group>
    : never
  : never;
