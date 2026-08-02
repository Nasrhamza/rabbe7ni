import {
  NativeAurora,
  NativeButton,
  NativeGlassCard,
  NativeMark,
} from "@rabbehni/design-system/native";
import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  ResponseType,
  useAuthRequest,
  useAutoDiscovery,
} from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import avatarDefault from "./assets/rabbehni/avatars/default/avatar-user-default-black.jpg";
import avatarWoman from "./assets/rabbehni/avatars/default/avatar-female-bun-pink.jpg";
import avatarMan from "./assets/rabbehni/avatars/default/avatar-male-blue-shirt.jpg";
import avatarMerchant from "./assets/rabbehni/avatars/default/avatar-merchant.jpg";
import badgeBronze from "./assets/rabbehni/badges/3d/achievement-medal-bronze-3d.png";
import badgeGold from "./assets/rabbehni/badges/3d/achievement-medal-gold-3d.png";
import badgeSilver from "./assets/rabbehni/badges/3d/achievement-medal-silver-3d.png";
import missionComplete from "./assets/rabbehni/badges/badge-mission-complete.png";
import rankBronze from "./assets/rabbehni/badges/rankings/ranking-medal-bronze-third.jpg";
import rankGold from "./assets/rabbehni/badges/rankings/ranking-medal-gold-first.jpg";
import rankSilver from "./assets/rabbehni/badges/rankings/ranking-medal-silver-second.jpg";
import emailNotification from "./assets/rabbehni/communication/email-notification-3d.png";
import rewardGift from "./assets/rabbehni/gamification/icon-reward-gift-box.png";
import spinWheel from "./assets/rabbehni/gamification/icon-spin-and-win-wheel.png";
import winTrophy from "./assets/rabbehni/gamification/icon-win-trophy.png";
import favoriteStar from "./assets/rabbehni/icons/icon-favorite-star-3d.png";
import emptySearch from "./assets/rabbehni/states/state-empty-search-question.png";
import {
  CustomerAuthScreen,
  type CustomerLoginInput,
  type CustomerRegistrationInput,
} from "./customer-auth-screen";
import {
  type CustomerGamesPayload,
  GamesCenter,
  type GameCode,
  type GamePlayResult,
} from "./games-center";

WebBrowser.maybeCompleteAuthSession();

const issuer = process.env.EXPO_PUBLIC_OIDC_ISSUER_URL ?? "http://10.0.2.2:8080/realms/rabbehni";
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000";
const clientId = process.env.EXPO_PUBLIC_OIDC_CLIENT_ID ?? "rabbehni-mobile";
const passwordLoginEnabled = process.env.EXPO_PUBLIC_PASSWORD_LOGIN === "true";
const redirectUri =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URI ??
  makeRedirectUri({ native: "rabbehni://auth/callback", path: "auth/callback" });

const mobileAssets = {
  avatar: avatarDefault,
  avatarMan,
  avatarMerchant,
  avatarWoman,
  badgeBronze,
  badgeGold,
  badgeSilver,
  email: emailNotification,
  empty: emptySearch,
  favorite: favoriteStar,
  mission: missionComplete,
  rankBronze,
  rankGold,
  rankSilver,
  reward: rewardGift,
  spin: spinWheel,
  trophy: winTrophy,
} as const;

type AvatarKey = "default" | "man" | "merchant" | "woman";

function avatarAsset(key: AvatarKey): ImageSourcePropType {
  if (key === "woman") return mobileAssets.avatarWoman;
  if (key === "man") return mobileAssets.avatarMan;
  if (key === "merchant") return mobileAssets.avatarMerchant;
  return mobileAssets.avatar;
}

function deepLinkLabel(deepLink: Readonly<Record<string, unknown>>): string {
  const screen = deepLink.screen ?? deepLink.route ?? deepLink.destination;
  if (typeof screen !== "string") return "Section associée";
  const labels: Readonly<Record<string, string>> = {
    challenges: "Mes challenges",
    games: "Espace jeux",
    history: "Historique des points",
    notifications: "Notifications",
    profile: "Mon profil",
    qr: "Mon QR",
    rewards: "Catalogue des récompenses",
  };
  return labels[screen.replace(/^\/?workspace\//, "")] ?? "Section associée";
}

function rankAsset(rank: number): ImageSourcePropType | undefined {
  if (rank === 1) return mobileAssets.rankGold;
  if (rank === 2) return mobileAssets.rankSilver;
  if (rank === 3) return mobileAssets.rankBronze;
  return undefined;
}

function badgeAsset(rarity: string): ImageSourcePropType {
  if (rarity === "LEGENDARY" || rarity === "EPIC") return mobileAssets.badgeGold;
  if (rarity === "RARE") return mobileAssets.badgeSilver;
  return mobileAssets.badgeBronze;
}

function consentGranted(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "granted" in value && value.granted);
}

function challengeRewardSummary(rewards: readonly { type: string; amount?: number }[]): string {
  if (rewards.length === 0) return "Badge ou avantage selon les règles du challenge";
  return rewards
    .map((reward) => {
      const amount = reward.amount ? `${reward.amount} ` : "";
      if (reward.type === "POINTS") return `${amount}points`;
      if (reward.type === "XP") return `${amount}XP`;
      if (reward.type === "BADGE") return "badge exclusif";
      return "récompense";
    })
    .join(" + ");
}

function SectionAsset({ alt, source }: Readonly<{ alt: string; source: ImageSourcePropType }>) {
  return (
    <Image
      accessibilityLabel={alt}
      resizeMode="contain"
      source={source}
      style={styles.sectionAsset}
    />
  );
}

interface MobilePrincipal {
  readonly displayName: string;
  readonly email: string;
  readonly tenantId: string;
  readonly permissions: readonly string[];
}

interface StoredTokens {
  readonly accessToken: string;
  readonly refreshToken?: string;
}

const tokenStorageKey = "rabbehni.oidc.tokens";

export default function App() {
  const discovery = useAutoDiscovery(issuer);
  const [tokens, setTokens] = useState<StoredTokens>();
  const [principal, setPrincipal] = useState<MobilePrincipal>();
  const [status, setStatus] = useState<"loading" | "ready" | "authenticating" | "error">("loading");
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      redirectUri,
      responseType: ResponseType.Code,
      scopes: ["openid", "profile", "email"],
      usePKCE: true,
    },
    discovery,
  );

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    if (
      response?.type !== "success" ||
      !response.params.code ||
      !discovery ||
      !request?.codeVerifier
    ) {
      if (response?.type === "error" || response?.type === "dismiss") {
        setStatus("error");
      }
      return;
    }
    void completeLogin(response.params.code, request.codeVerifier, discovery);
  }, [discovery, request?.codeVerifier, response]);

  async function restoreSession() {
    const stored = await SecureStore.getItemAsync(tokenStorageKey);
    if (!stored) {
      setStatus("ready");
      return;
    }
    const restored = JSON.parse(stored) as StoredTokens;
    setTokens(restored);
    const valid = await loadPrincipal(restored.accessToken);
    if (!valid && restored.refreshToken && discovery) {
      await refreshSession(restored.refreshToken, discovery);
      return;
    }
    setStatus(valid ? "ready" : "error");
  }

  async function completeLogin(
    code: string,
    codeVerifier: string,
    oidcDiscovery: NonNullable<typeof discovery>,
  ) {
    setStatus("authenticating");
    try {
      const result = await exchangeCodeAsync(
        {
          clientId,
          code,
          extraParams: { code_verifier: codeVerifier },
          redirectUri,
        },
        oidcDiscovery,
      );
      const nextTokens = {
        accessToken: result.accessToken,
        ...(result.refreshToken ? { refreshToken: result.refreshToken } : {}),
      };
      await persistTokens(nextTokens);
      await loadPrincipal(nextTokens.accessToken);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function refreshSession(
    refreshToken: string,
    oidcDiscovery: NonNullable<typeof discovery>,
  ) {
    setStatus("authenticating");
    try {
      const result = await refreshAsync({ clientId, refreshToken }, oidcDiscovery);
      const nextTokens = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? refreshToken,
      };
      await persistTokens(nextTokens);
      await loadPrincipal(nextTokens.accessToken);
      setStatus("ready");
    } catch {
      await signOut();
      setStatus("error");
    }
  }

  async function persistTokens(nextTokens: StoredTokens) {
    setTokens(nextTokens);
    await SecureStore.setItemAsync(tokenStorageKey, JSON.stringify(nextTokens), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async function loadPrincipal(accessToken: string): Promise<boolean> {
    const result = await fetch(`${apiUrl}/v1/auth/session`, {
      headers: { authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
    if (!result?.ok) {
      return false;
    }
    const payload = (await result.json()) as { principal: MobilePrincipal };
    setPrincipal(payload.principal);
    return true;
  }

  async function signOut() {
    setTokens(undefined);
    setPrincipal(undefined);
    await SecureStore.deleteItemAsync(tokenStorageKey);
  }

  async function loginCustomer(input: CustomerLoginInput) {
    if (!passwordLoginEnabled) {
      setStatus("authenticating");
      const result = await promptAsync();
      if (result.type !== "success") {
        setStatus("ready");
        throw new Error("La fenêtre de connexion a été fermée.");
      }
      return;
    }

    setStatus("authenticating");
    try {
      const tokenResponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: "password",
          password: input.password,
          scope: "openid profile email",
          username: input.email,
        }).toString(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
      });
      if (!tokenResponse.ok) {
        throw new Error("Email ou mot de passe incorrect.");
      }
      const payload = (await tokenResponse.json()) as {
        access_token?: string;
        refresh_token?: string;
      };
      if (!payload.access_token) {
        throw new Error("Keycloak n’a pas retourné de session valide.");
      }
      const nextTokens: StoredTokens = {
        accessToken: payload.access_token,
        ...(payload.refresh_token ? { refreshToken: payload.refresh_token } : {}),
      };
      await persistTokens(nextTokens);
      if (!(await loadPrincipal(nextTokens.accessToken))) {
        await signOut();
        throw new Error("Ce compte n’a pas accès à l’application client.");
      }
      setStatus("ready");
    } catch (error) {
      setStatus("ready");
      throw error;
    }
  }

  async function registerCustomer(input: CustomerRegistrationInput) {
    const registrationResponse = await fetch(`${apiUrl}/v1/auth/customer-registration`, {
      body: JSON.stringify(input),
      headers: { "content-type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
    if (!registrationResponse) {
      throw new Error("Le serveur Rabbehni est inaccessible.");
    }
    if (!registrationResponse.ok) {
      const payload = (await registrationResponse.json().catch(() => undefined)) as
        { message?: string | readonly string[] } | undefined;
      const message = Array.isArray(payload?.message) ? payload.message[0] : payload?.message;
      throw new Error(message ?? "La création du compte a échoué.");
    }
  }

  return (
    <SafeAreaProvider>
      <NativeAurora>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar style="light" />
          {status === "loading" ? (
            <ActivityIndicator color="#4bd5a7" size="large" />
          ) : principal && tokens ? (
            <ProtectedFoundation
              accessToken={tokens.accessToken}
              onRefresh={() => {
                if (tokens.refreshToken && discovery) {
                  void refreshSession(tokens.refreshToken, discovery);
                }
              }}
              onSignOut={() => void signOut()}
              principal={principal}
              refreshing={status === "authenticating"}
            />
          ) : (
            <CustomerAuthScreen
              authError={status === "error"}
              loginLoading={status === "authenticating" || (!passwordLoginEnabled && !request)}
              onLogin={loginCustomer}
              onRegister={registerCustomer}
            />
          )}
        </SafeAreaView>
      </NativeAurora>
    </SafeAreaProvider>
  );
}

function ProtectedFoundation({
  accessToken,
  onRefresh,
  onSignOut,
  principal,
  refreshing,
}: Readonly<{
  accessToken: string;
  onRefresh: () => void;
  onSignOut: () => void;
  principal: MobilePrincipal;
  refreshing: boolean;
}>) {
  type MobileTab =
    | "home"
    | "games"
    | "gamification"
    | "challenges"
    | "missions"
    | "badges"
    | "leaderboard"
    | "history"
    | "notifications"
    | "communication"
    | "insights"
    | "profile"
    | "qr"
    | "rewards";
  type Row = Record<string, unknown>;
  type Customer = {
    id: string;
    displayName: string;
    email?: string;
    phone?: string;
    locale: string;
    preferences: Record<string, unknown>;
    communicationPreferences: Record<string, unknown>;
    consents: Record<string, unknown>;
    activities?: readonly {
      id: string;
      type: string;
      occurredAt: string;
      metadata: Record<string, unknown>;
    }[];
  };
  type Reward = {
    id: string;
    name: string;
    description?: string;
    pointsCost: number;
    stockQuantity?: number;
    unlimitedStock: boolean;
  };
  type LedgerEntry = {
    id: string;
    type: string;
    points: number;
    createdAt: string;
    program?: { name: string };
  };
  type GamificationProfile = {
    profile: {
      totalXp: number;
      currentLevel?: { level: number; name: string; xpThreshold: number };
      leaderboardOptOut: boolean;
      anonymizeOnLeaderboard: boolean;
    };
    nextLevel?: { level: number; name: string; xpThreshold: number };
  };
  type Challenge = {
    id: string;
    name: string;
    description?: string;
    target: number;
    status: string;
    endAt: string;
    enrollments?: readonly { progress: number; status: string }[];
    rewards?: readonly { type: string; amount?: number }[];
  };
  type Habit = {
    id: string;
    name: string;
    description?: string;
    cadence: string;
    target: number;
    customers?: readonly {
      currentPeriodProgress: number;
      currentStreak: number;
      longestStreak: number;
    }[];
  };
  type Badge = {
    id: string;
    name: string;
    description?: string;
    rarity: string;
    earned: boolean;
    earnedAt?: string;
    progress: number;
    target: number;
  };
  type Leaderboard = {
    id: string;
    name: string;
    period: string;
    metric: string;
  };
  type LeaderboardEntry = {
    id: string;
    rank: number;
    score: number;
    displayName: string;
    anonymized: boolean;
    customerId: string;
  };
  type Streak = {
    id: string;
    currentStreak: number;
    longestStreak: number;
    freezesRemaining: number;
    rule: { name: string };
  };
  type InboxNotification = {
    id: string;
    title: string;
    body: string;
    category: string;
    createdAt: string;
    expiresAt?: string;
    readAt?: string;
    deepLink?: Readonly<Record<string, unknown>>;
  };
  type CommunicationPreference = {
    id: string;
    channel: "EMAIL" | "SMS" | "PUSH" | "IN_APP" | "WHATSAPP";
    category: string;
    optedIn: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone: string;
  };
  type PersonalAnalytics = {
    items: readonly {
      metric: string;
      value: number;
      previousValue: number | null;
      changeRate: number | null;
    }[];
    freshnessSeconds: number | null;
  };
  type PersonalRecommendation = {
    summary: string;
    confidence: number;
    uncertainty: string;
    recommendations: readonly string[];
    humanReviewRequired: boolean;
  };
  type ReferralSummary = {
    code: string;
    rewardPoints: number;
    invited: number;
    rewarded: number;
  };
  const [tab, setTab] = useState<MobileTab>("home");
  const [customer, setCustomer] = useState<Customer>();
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<readonly Reward[]>([]);
  const [history, setHistory] = useState<readonly LedgerEntry[]>([]);
  const [qrToken, setQrToken] = useState<string>();
  const [selectedReward, setSelectedReward] = useState<Reward>();
  const [gamification, setGamification] = useState<GamificationProfile>();
  const [challenges, setChallenges] = useState<readonly Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge>();
  const [habits, setHabits] = useState<readonly Habit[]>([]);
  const [habitHistory, setHabitHistory] = useState<readonly Row[]>([]);
  const [badges, setBadges] = useState<readonly Badge[]>([]);
  const [streaks, setStreaks] = useState<readonly Streak[]>([]);
  const [leaderboards, setLeaderboards] = useState<readonly Leaderboard[]>([]);
  const [leaderboardEntries, setLeaderboardEntries] = useState<readonly LeaderboardEntry[]>([]);
  const [notifications, setNotifications] = useState<readonly InboxNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<InboxNotification>();
  const [communicationPreferences, setCommunicationPreferences] = useState<
    readonly CommunicationPreference[]
  >([]);
  const [personalAnalytics, setPersonalAnalytics] = useState<PersonalAnalytics>();
  const [personalRecommendation, setPersonalRecommendation] = useState<PersonalRecommendation>();
  const [customerGames, setCustomerGames] = useState<CustomerGamesPayload>();
  const [referral, setReferral] = useState<ReferralSummary>();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileCurrency, setProfileCurrency] = useState("TND");
  const [profileLocale, setProfileLocale] = useState<"ar-TN" | "en" | "fr-TN">("fr-TN");
  const [profileAvatar, setProfileAvatar] = useState<AvatarKey>("default");
  const [dataState, setDataState] = useState<"error" | "loading" | "ready" | "saving">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadExperience();
  }, [accessToken]);

  async function mobileApi<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiUrl}/v1${path}`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        ...init?.headers,
      },
      ...init,
    });
    if (!response.ok) {
      const problem = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(problem?.message ?? `HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  }

  async function loadExperience() {
    setDataState("loading");
    try {
      const profile = await mobileApi<Customer>("/customers/me");
      const [
        balances,
        rewardResult,
        ledgerResult,
        gamificationResult,
        challengeResult,
        habitResult,
        badgeResult,
        streakResult,
        habitCalendar,
        leaderboardConfigs,
        inbox,
        preferences,
        analytics,
        gameResult,
        referralResult,
        twoFactorResult,
      ] = await Promise.all([
        mobileApi<{ balances?: readonly { balance: number }[] }>(
          `/points/balance?customerId=${profile.id}`,
        ),
        mobileApi<{ items: readonly Reward[] }>("/rewards?status=ACTIVE&pageSize=100"),
        mobileApi<{ items: readonly LedgerEntry[] }>(
          `/points/transactions?customerId=${profile.id}&pageSize=100`,
        ),
        mobileApi<GamificationProfile>(`/gamification/profile?customerId=${profile.id}`),
        mobileApi<{ items: readonly Challenge[] }>(
          `/challenges?customerId=${profile.id}&status=ACTIVE&pageSize=100`,
        ),
        mobileApi<{ items: readonly Habit[] }>(
          `/habits?customerId=${profile.id}&status=ACTIVE&pageSize=100`,
        ),
        mobileApi<{ items: readonly Badge[] }>(
          `/badges/collection/customer?customerId=${profile.id}&includeLocked=true&pageSize=100`,
        ),
        mobileApi<readonly Streak[]>(`/habits/streaks/customer/${profile.id}`),
        mobileApi<{ items: readonly Row[] }>(
          `/habits/customer/calendar?customerId=${profile.id}&pageSize=60`,
        ),
        mobileApi<readonly Leaderboard[]>("/leaderboards/public"),
        mobileApi<{ items: readonly InboxNotification[]; unread: number }>(
          `/notifications/inbox/${profile.id}?pageSize=100`,
        ),
        mobileApi<readonly CommunicationPreference[]>(`/notifications/preferences/${profile.id}`),
        mobileApi<PersonalAnalytics>("/analytics/customer-summary"),
        mobileApi<CustomerGamesPayload>("/games"),
        mobileApi<ReferralSummary>("/customers/me/referral"),
        mobileApi<{ enabled: boolean }>("/auth/two-factor"),
      ]);
      setCustomer(profile);
      setProfileName(profile.displayName);
      setProfilePhone(profile.phone ?? "");
      setProfileCurrency(String(profile.preferences.preferredCurrency ?? "TND"));
      setProfileLocale(
        profile.locale === "ar-TN" || profile.locale === "en" ? profile.locale : "fr-TN",
      );
      setProfileAvatar(
        profile.preferences.avatarKey === "woman" ||
          profile.preferences.avatarKey === "man" ||
          profile.preferences.avatarKey === "merchant"
          ? profile.preferences.avatarKey
          : "default",
      );
      setBalance((balances.balances ?? []).reduce((sum, item) => sum + item.balance, 0));
      setRewards(rewardResult.items);
      setHistory(ledgerResult.items);
      setGamification(gamificationResult);
      setChallenges(challengeResult.items);
      setHabits(habitResult.items);
      setBadges(badgeResult.items);
      setStreaks(streakResult);
      setHabitHistory(habitCalendar.items);
      setLeaderboards(leaderboardConfigs);
      setNotifications(inbox.items);
      setUnreadNotifications(inbox.unread);
      setCommunicationPreferences(preferences);
      setPersonalAnalytics(analytics);
      setCustomerGames(gameResult);
      setReferral(referralResult);
      setTwoFactorEnabled(twoFactorResult.enabled);
      if (leaderboardConfigs[0]) {
        const results = await mobileApi<{ items: readonly LeaderboardEntry[] }>(
          `/leaderboards/${leaderboardConfigs[0].id}/results?pageSize=100`,
        );
        setLeaderboardEntries(results.items);
      } else {
        setLeaderboardEntries([]);
      }
      setDataState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Chargement impossible");
      setDataState("error");
    }
  }

  async function loadPersonalRecommendation() {
    setDataState("saving");
    try {
      setPersonalRecommendation(
        await mobileApi<PersonalRecommendation>("/analytics/customer-recommendation", {
          method: "POST",
        }),
      );
      setDataState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recommandation indisponible");
      setDataState("error");
    }
  }

  async function issueQr() {
    setDataState("saving");
    try {
      const result = await mobileApi<{ token: string }>("/qr/tokens", {
        method: "POST",
        body: JSON.stringify({ purpose: "IDENTITY", ttlSeconds: 60 }),
      });
      setQrToken(result.token);
      setDataState("ready");
      setMessage("QR sécurisé valable 60 secondes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "QR indisponible");
      setDataState("error");
    }
  }

  async function redeem(reward: Reward) {
    if (!customer) return;
    setDataState("saving");
    try {
      await mobileApi("/rewards/redemptions", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer.id,
          rewardId: reward.id,
          quantity: 1,
          idempotencyKey: `mobile:${customer.id}:${reward.id}:${Date.now()}`,
        }),
      });
      setMessage(`${reward.name} échangée avec succès.`);
      setSelectedReward(undefined);
      await loadExperience();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Échange impossible");
      setDataState("error");
    }
  }

  async function playGame(code: GameCode): Promise<GamePlayResult> {
    setDataState("saving");
    try {
      const played = await mobileApi<GamePlayResult>(`/games/${code}/play`, {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: `mobile:${customer?.id ?? "customer"}:${code}:${Date.now()}`,
        }),
      });
      if (typeof played.balance === "number") setBalance(played.balance);
      setCustomerGames(await mobileApi<CustomerGamesPayload>("/games"));
      setDataState("ready");
      return played;
    } catch (error) {
      setDataState("ready");
      throw error;
    }
  }

  async function togglePushPreference() {
    if (!customer) return;
    setDataState("saving");
    const current = Boolean(customer.communicationPreferences.push);
    try {
      const updated = await mobileApi<Customer>("/customers/me/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          communicationPreferences: {
            ...customer.communicationPreferences,
            push: !current,
          },
        }),
      });
      setCustomer(updated);
      setMessage("Préférences enregistrées.");
      setDataState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible");
      setDataState("error");
    }
  }

  async function saveProfile() {
    if (!customer || !profileName.trim() || !profilePhone.trim()) return;
    setDataState("saving");
    try {
      const updated = await mobileApi<Customer>("/customers/me/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: profileName.trim(),
          phone: profilePhone.trim(),
          locale: profileLocale,
          preferredCurrency: profileCurrency,
          avatarKey: profileAvatar,
        }),
      });
      setCustomer(updated);
      setMessage("Profil enregistré avec succès.");
      setDataState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profil non enregistré");
      setDataState("error");
    }
  }

  async function enableTwoFactor() {
    setDataState("saving");
    try {
      await mobileApi("/auth/two-factor/setup", { method: "POST", body: "{}" });
      setMessage("Un lien sécurisé de configuration OTP a été envoyé par email.");
      setDataState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Configuration 2FA indisponible");
      setDataState("error");
    }
  }

  async function toggleLeaderboardPrivacy() {
    if (!customer || !gamification) return;
    setDataState("saving");
    try {
      await mobileApi("/gamification/profile/privacy", {
        method: "PATCH",
        body: JSON.stringify({
          customerId: customer.id,
          leaderboardOptOut: !gamification.profile.leaderboardOptOut,
          anonymizeOnLeaderboard: true,
        }),
      });
      setMessage("Confidentialité du classement mise à jour.");
      await loadExperience();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise à jour impossible");
      setDataState("error");
    }
  }

  async function markNotificationRead(notification: InboxNotification) {
    if (!customer || notification.readAt) {
      setSelectedNotification(notification);
      return;
    }
    setDataState("saving");
    try {
      const updated = await mobileApi<InboxNotification>(
        `/notifications/inbox/${customer.id}/${notification.id}/read`,
        { method: "PATCH" },
      );
      setNotifications((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setUnreadNotifications((count) => Math.max(0, count - 1));
      setSelectedNotification(updated);
      setDataState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notification indisponible");
      setDataState("error");
    }
  }

  async function markAllNotificationsRead() {
    if (!customer) return;
    setDataState("saving");
    try {
      await mobileApi(`/notifications/inbox/${customer.id}/read-all`, { method: "PATCH" });
      const readAt = new Date().toISOString();
      setNotifications((items) =>
        items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
      );
      setUnreadNotifications(0);
      setMessage("Toutes les notifications sont marquées comme lues.");
      setDataState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise à jour impossible");
      setDataState("error");
    }
  }

  async function toggleCommunicationPreference(channel: CommunicationPreference["channel"]) {
    if (!customer) return;
    const current = communicationPreferences.find(
      (item) => item.channel === channel && item.category === "MARKETING",
    );
    setDataState("saving");
    try {
      const updated = await mobileApi<CommunicationPreference>("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          customerId: customer.id,
          channel,
          category: "MARKETING",
          optedIn: !(current?.optedIn ?? true),
          quietHoursStart: current?.quietHoursStart ?? "22:00",
          quietHoursEnd: current?.quietHoursEnd ?? "08:00",
          timezone: current?.timezone ?? "Europe/Paris",
          consentSource: "customer-mobile",
        }),
      });
      setCommunicationPreferences((items) => [
        ...items.filter((item) => !(item.channel === channel && item.category === "MARKETING")),
        updated,
      ]);
      setMessage("Préférence de communication enregistrée.");
      setDataState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise à jour impossible");
      setDataState("error");
    }
  }

  const tabs: readonly { key: MobileTab; label: string }[] = [
    { key: "home", label: "Accueil" },
    { key: "games", label: "Jeux" },
    { key: "qr", label: "Mon QR" },
    { key: "rewards", label: "Récompenses" },
    { key: "profile", label: "Profil" },
  ];
  const latestInstantReward = customer?.activities?.find(
    (activity) =>
      activity.type === "reward.instant-granted" ||
      (activity.type === "points.earn" && activity.metadata.source === "qr-instant-reward"),
  );

  return (
    <ScrollView contentContainerStyle={styles.protected} showsVerticalScrollIndicator={false}>
      <View style={styles.protectedHeader}>
        <NativeMark />
        <Image
          accessibilityLabel="Avatar du profil client"
          resizeMode="cover"
          source={avatarAsset(profileAvatar)}
          style={styles.headerAvatar}
        />
        <View style={styles.securePill}>
          <View style={styles.secureDot} />
          <Text style={styles.secureText}>PROTECTED</Text>
        </View>
      </View>
      <Text style={styles.welcome}>Bonjour, {customer?.displayName ?? principal.displayName}.</Text>
      <Text style={styles.description}>Vos points, vos jeux, vos cadeaux et votre QR.</Text>
      <ScrollView
        contentContainerStyle={styles.tabs}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {tabs.map((item) => (
          <NativeButton
            key={item.key}
            onPress={() => setTab(item.key)}
            variant={tab === item.key ? "primary" : "secondary"}
          >
            {item.label}
          </NativeButton>
        ))}
      </ScrollView>
      {message ? (
        <Text
          accessibilityRole="alert"
          style={dataState === "error" ? styles.error : styles.notice}
        >
          {message}
        </Text>
      ) : null}
      {dataState === "loading" ? (
        <ActivityIndicator color="#4bd5a7" size="large" />
      ) : tab === "home" ? (
        <View style={styles.homeStack}>
          {latestInstantReward ? (
            <View style={styles.instantWinBanner}>
              <Text style={styles.instantWinIcon}>★</Text>
              <View style={styles.instantWinCopy}>
                <Text style={styles.instantWinEyebrow}>DERNIÈRE SURPRISE QR</Text>
                <Text style={styles.instantWinTitle}>
                  {typeof latestInstantReward.metadata.rewardName === "string"
                    ? latestInstantReward.metadata.rewardName
                    : `+${Number(latestInstantReward.metadata.points ?? 0)} points`}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={styles.balanceCard}>
            <View>
              <Text style={styles.balanceEyebrow}>MON SOLDE</Text>
              <View style={styles.balanceLine}>
                <Text style={styles.balanceMetric}>{balance}</Text>
                <Text style={styles.balanceUnit}>points</Text>
              </View>
              <Text style={styles.balanceHint}>Utilisez-les chez Café Medina</Text>
            </View>
            <SectionAsset alt="Étoile des avantages fidélité" source={mobileAssets.favorite} />
          </View>

          <View style={styles.gamePromo}>
            <Image
              accessibilityLabel="Roue Spin & Win"
              resizeMode="contain"
              source={mobileAssets.spin}
              style={styles.gamePromoImage}
            />
            <View style={styles.gamePromoCopy}>
              <Text style={styles.gamePromoEyebrow}>CHANCE DU JOUR</Text>
              <Text style={styles.gamePromoTitle}>Tournez & gagnez</Text>
              <Text style={styles.gamePromoText}>Jusqu’à 200 points à gagner maintenant.</Text>
              <NativeButton onPress={() => setTab("games")}>Jouer maintenant</NativeButton>
            </View>
          </View>

          <Text style={styles.homeSectionTitle}>Actions rapides</Text>
          <View style={styles.quickGrid}>
            <Pressable onPress={() => setTab("qr")} style={[styles.quickCard, styles.quickBlue]}>
              <Text style={styles.quickIcon}>▦</Text>
              <Text style={styles.quickTitle}>Mon QR</Text>
              <Text style={styles.quickText}>À présenter en caisse</Text>
            </Pressable>
            <Pressable
              onPress={() => setTab("rewards")}
              style={[styles.quickCard, styles.quickYellow]}
            >
              <Text style={styles.quickIcon}>◆</Text>
              <Text style={styles.quickTitle}>Cadeaux</Text>
              <Text style={styles.quickText}>{rewards.length} disponibles</Text>
            </Pressable>
          </View>

          <Text style={styles.homeSectionTitle}>Ma progression</Text>
          <View style={styles.activityMenu}>
            {[
              ["gamification", "Niveau & XP", `${gamification?.profile.totalXp ?? 0} XP`],
              ["challenges", "Challenges", `${challenges.length} actifs`],
              ["missions", "Missions & séries", `${habits.length} missions`],
              ["badges", "Badges", `${badges.filter((badge) => badge.earned).length} gagnés`],
              ["leaderboard", "Classement", "Voir mon rang"],
              ["history", "Historique", `${history.length} mouvements`],
              [
                "notifications",
                "Notifications",
                unreadNotifications > 0 ? `${unreadNotifications} nouvelles` : "Tout est lu",
              ],
              ["insights", "Mes tendances", "Voir mon activité"],
            ].map(([destination, title, detail]) => (
              <Pressable
                key={destination}
                onPress={() => setTab(destination as MobileTab)}
                style={styles.activityRow}
              >
                <View style={styles.activityDot} />
                <View style={styles.activityCopy}>
                  <Text style={styles.activityTitle}>{title}</Text>
                  <Text style={styles.activityDetail}>{detail}</Text>
                </View>
                <Text style={styles.activityArrow}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : tab === "games" ? (
        <GamesCenter
          balance={balance}
          games={customerGames}
          loading={dataState === "saving"}
          onPlay={playGame}
        />
      ) : tab === "gamification" ? (
        <View style={styles.stack}>
          <NativeGlassCard style={styles.heroCard}>
            <Text style={styles.eyebrow}>NIVEAU ACTUEL</Text>
            <SectionAsset alt="Progression gamifiée" source={mobileAssets.spin} />
            <Text style={styles.metric}>
              {gamification?.profile.currentLevel?.name ?? "Nouveau membre"}
            </Text>
            <Text style={styles.cardDescription}>
              {gamification?.profile.totalXp ?? 0} XP cumulés
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(
                      100,
                      ((gamification?.profile.totalXp ?? 0) /
                        Math.max(1, gamification?.nextLevel?.xpThreshold ?? 1)) *
                        100,
                    )}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.cardDescription}>
              {gamification?.nextLevel
                ? `${gamification.nextLevel.xpThreshold - gamification.profile.totalXp} XP avant ${gamification.nextLevel.name}`
                : "Niveau maximal atteint"}
            </Text>
          </NativeGlassCard>
          {gamification?.profile.currentLevel ? (
            <NativeGlassCard style={styles.celebration}>
              <Text style={styles.celebrationIcon}>🎉</Text>
              <Text style={styles.itemTitle}>
                Niveau {gamification.profile.currentLevel.level} atteint
              </Text>
              <Text style={styles.cardDescription}>
                Continuez vos missions pour débloquer les prochains avantages.
              </Text>
            </NativeGlassCard>
          ) : null}
        </View>
      ) : tab === "challenges" ? (
        <View style={styles.stack}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.cardTitle}>Challenges actifs</Text>
            <SectionAsset alt="Trophée des challenges" source={mobileAssets.trophy} />
          </View>
          {selectedChallenge ? (
            <NativeGlassCard>
              <Text style={styles.itemTitle}>{selectedChallenge.name}</Text>
              <Text style={styles.cardDescription}>{selectedChallenge.description}</Text>
              <Text style={styles.rewardCost}>
                {selectedChallenge.enrollments?.[0]?.progress ?? 0}/{selectedChallenge.target}
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        ((selectedChallenge.enrollments?.[0]?.progress ?? 0) /
                          selectedChallenge.target) *
                          100,
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.cardDescription}>
                Fin : {new Date(selectedChallenge.endAt).toLocaleDateString()}
              </Text>
              <Text style={styles.cardDescription}>
                Récompenses : {challengeRewardSummary(selectedChallenge.rewards ?? [])}
              </Text>
              {selectedChallenge.enrollments?.[0]?.status === "COMPLETED" ? (
                <View style={styles.celebration}>
                  <Text style={styles.celebrationIcon}>🏆</Text>
                  <Text style={styles.itemTitle}>Challenge terminé !</Text>
                </View>
              ) : null}
              <NativeButton onPress={() => setSelectedChallenge(undefined)} variant="secondary">
                Retour
              </NativeButton>
            </NativeGlassCard>
          ) : challenges.length === 0 ? (
            <Text style={styles.cardDescription}>Aucun challenge actif.</Text>
          ) : (
            challenges.map((challenge) => (
              <NativeGlassCard key={challenge.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{challenge.name}</Text>
                  <Text style={styles.positivePoints}>
                    {challenge.enrollments?.[0]?.progress ?? 0}/{challenge.target}
                  </Text>
                </View>
                <Text style={styles.cardDescription}>{challenge.description}</Text>
                <NativeButton onPress={() => setSelectedChallenge(challenge)} variant="secondary">
                  Voir le challenge
                </NativeButton>
              </NativeGlassCard>
            ))
          )}
        </View>
      ) : tab === "missions" ? (
        <View style={styles.stack}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.cardTitle}>Missions & habitudes</Text>
            <SectionAsset alt="Mission client" source={mobileAssets.mission} />
          </View>
          {habits.length === 0 ? (
            <Text style={styles.cardDescription}>Aucune mission active.</Text>
          ) : (
            habits.map((habit) => (
              <NativeGlassCard key={habit.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{habit.name}</Text>
                  <Text style={styles.rewardCost}>{habit.cadence}</Text>
                </View>
                <Text style={styles.cardDescription}>{habit.description}</Text>
                <Text style={styles.positivePoints}>
                  {habit.customers?.[0]?.currentPeriodProgress ?? 0}/{habit.target}
                </Text>
                <Text style={styles.cardDescription}>
                  Série : {habit.customers?.[0]?.currentStreak ?? 0} · Record :{" "}
                  {habit.customers?.[0]?.longestStreak ?? 0}
                </Text>
              </NativeGlassCard>
            ))
          )}
          <Text style={styles.cardTitle}>Streaks</Text>
          {streaks.map((streak) => (
            <NativeGlassCard key={streak.id}>
              <Text style={styles.itemTitle}>{streak.rule.name}</Text>
              <Text style={styles.smallMetric}>{streak.currentStreak} jours</Text>
              <Text style={styles.cardDescription}>
                Record {streak.longestStreak} · {streak.freezesRemaining} freeze(s)
              </Text>
            </NativeGlassCard>
          ))}
          <Text style={styles.cardTitle}>Calendrier récent</Text>
          <View style={styles.calendar}>
            {habitHistory.slice(0, 28).map((entry) => (
              <View
                key={String(entry.id)}
                style={[
                  styles.calendarDay,
                  entry.completed ? styles.calendarDayCompleted : undefined,
                ]}
              >
                <Text style={styles.calendarText}>
                  {String(entry.localDate ?? "").slice(8, 10)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : tab === "badges" ? (
        <View style={styles.stack}>
          <Text style={styles.cardTitle}>Badges & achievements</Text>
          {badges.length === 0 ? (
            <Text style={styles.cardDescription}>Aucun badge disponible.</Text>
          ) : (
            badges.map((badge) => (
              <NativeGlassCard
                key={badge.id}
                {...(badge.earned ? { style: styles.earnedBadge } : {})}
              >
                <Image
                  accessibilityLabel={`Médaille ${badge.rarity}`}
                  resizeMode="contain"
                  source={badgeAsset(badge.rarity)}
                  style={styles.badgeMedal}
                />
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>
                    {badge.earned ? "◆" : "◇"} {badge.name}
                  </Text>
                  <Text style={styles.rewardCost}>{badge.rarity}</Text>
                </View>
                <Text style={styles.cardDescription}>{badge.description}</Text>
                <Text style={styles.cardDescription}>
                  {badge.earned
                    ? `Obtenu ${badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : ""}`
                    : `Progression ${badge.progress}/${badge.target}`}
                </Text>
              </NativeGlassCard>
            ))
          )}
        </View>
      ) : tab === "leaderboard" ? (
        <View style={styles.stack}>
          <Text style={styles.cardTitle}>{leaderboards[0]?.name ?? "Classement"}</Text>
          <Text style={styles.cardDescription}>
            {leaderboards[0]
              ? `${leaderboards[0].period} · ${leaderboards[0].metric}`
              : "Aucun classement actif."}
          </Text>
          {leaderboardEntries.map((entry) => (
            <NativeGlassCard key={entry.id}>
              <View style={styles.rowBetween}>
                {rankAsset(entry.rank) ? (
                  <Image
                    accessibilityLabel={`Médaille du rang ${entry.rank}`}
                    resizeMode="contain"
                    source={rankAsset(entry.rank)}
                    style={styles.rankMedal}
                  />
                ) : null}
                <Text style={styles.rank}>#{entry.rank}</Text>
                <Text style={styles.itemTitle}>{entry.displayName}</Text>
                <Text style={styles.positivePoints}>{entry.score}</Text>
              </View>
            </NativeGlassCard>
          ))}
          <NativeGlassCard>
            <Text style={styles.itemTitle}>Confidentialité</Text>
            <Text style={styles.cardDescription}>
              Participation :{" "}
              {gamification?.profile.leaderboardOptOut ? "désactivée/anonymisée" : "active"}
            </Text>
            <NativeButton
              disabled={dataState === "saving"}
              onPress={() => void toggleLeaderboardPrivacy()}
              variant="secondary"
            >
              {gamification?.profile.leaderboardOptOut
                ? "Réactiver ma participation"
                : "Me retirer du classement"}
            </NativeButton>
          </NativeGlassCard>
        </View>
      ) : tab === "qr" ? (
        <NativeGlassCard style={styles.qrCard}>
          <Text style={styles.cardTitle}>Mon identité QR</Text>
          <Text style={styles.cardDescription}>
            Le code est signé, lié à votre tenant et expire automatiquement.
          </Text>
          {qrToken ? (
            <View style={styles.qrSurface}>
              <QRCode value={qrToken} size={220} backgroundColor="#ffffff" color="#09241c" />
            </View>
          ) : (
            <NativeButton disabled={dataState === "saving"} onPress={() => void issueQr()}>
              Générer mon QR
            </NativeButton>
          )}
          {qrToken && (
            <NativeButton
              disabled={dataState === "saving"}
              onPress={() => void issueQr()}
              variant="secondary"
            >
              Renouveler
            </NativeButton>
          )}
        </NativeGlassCard>
      ) : tab === "history" ? (
        <View style={styles.stack}>
          <Text style={styles.cardTitle}>Historique</Text>
          {history.length === 0 ? (
            <Text style={styles.cardDescription}>Aucune transaction pour le moment.</Text>
          ) : (
            history.map((entry) => (
              <NativeGlassCard key={entry.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{entry.program?.name ?? entry.type}</Text>
                  <Text style={entry.points >= 0 ? styles.positivePoints : styles.negativePoints}>
                    {entry.points >= 0 ? "+" : ""}
                    {entry.points}
                  </Text>
                </View>
                <Text style={styles.cardDescription}>
                  {entry.type} · {new Date(entry.createdAt).toLocaleDateString()}
                </Text>
              </NativeGlassCard>
            ))
          )}
        </View>
      ) : tab === "rewards" ? (
        <View style={styles.stack}>
          <SectionAsset alt="Cadeau de récompense" source={mobileAssets.reward} />
          <Text style={styles.cardTitle}>Récompenses disponibles</Text>
          {selectedReward ? (
            <NativeGlassCard>
              <Text style={styles.itemTitle}>{selectedReward.name}</Text>
              <Text style={styles.cardDescription}>{selectedReward.description}</Text>
              <Text style={styles.rewardCost}>{selectedReward.pointsCost} points</Text>
              <NativeButton
                disabled={dataState === "saving" || balance < selectedReward.pointsCost}
                onPress={() => void redeem(selectedReward)}
              >
                Échanger
              </NativeButton>
              <NativeButton onPress={() => setSelectedReward(undefined)} variant="secondary">
                Retour
              </NativeButton>
            </NativeGlassCard>
          ) : rewards.length === 0 ? (
            <Text style={styles.cardDescription}>Aucune récompense disponible.</Text>
          ) : (
            rewards.map((reward) => (
              <NativeGlassCard key={reward.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{reward.name}</Text>
                  <Text style={styles.rewardCost}>{reward.pointsCost} pts</Text>
                </View>
                <Text style={styles.cardDescription}>{reward.description}</Text>
                <NativeButton onPress={() => setSelectedReward(reward)} variant="secondary">
                  Voir le détail
                </NativeButton>
              </NativeGlassCard>
            ))
          )}
        </View>
      ) : tab === "notifications" ? (
        <View style={styles.stack}>
          <SectionAsset alt="Notification par e-mail" source={mobileAssets.email} />
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Notifications</Text>
            {unreadNotifications > 0 ? (
              <NativeButton
                disabled={dataState === "saving"}
                onPress={() => void markAllNotificationsRead()}
                variant="secondary"
              >
                Tout lire
              </NativeButton>
            ) : null}
          </View>
          {selectedNotification ? (
            <NativeGlassCard>
              <Text style={styles.eyebrow}>{selectedNotification.category}</Text>
              <Text style={styles.itemTitle}>{selectedNotification.title}</Text>
              <Text style={styles.cardDescription}>{selectedNotification.body}</Text>
              <Text style={styles.cardDescription}>
                {new Date(selectedNotification.createdAt).toLocaleString()}
              </Text>
              {selectedNotification.deepLink ? (
                <Text style={styles.rewardCost}>
                  Destination : {deepLinkLabel(selectedNotification.deepLink)}
                </Text>
              ) : null}
              <NativeButton onPress={() => setSelectedNotification(undefined)} variant="secondary">
                Retour
              </NativeButton>
            </NativeGlassCard>
          ) : notifications.length === 0 ? (
            <Text style={styles.cardDescription}>Votre boîte de réception est vide.</Text>
          ) : (
            notifications.map((notification) => (
              <NativeGlassCard key={notification.id}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{notification.title}</Text>
                  <Text
                    style={notification.readAt ? styles.cardDescription : styles.positivePoints}
                  >
                    {notification.readAt ? "Lue" : "Nouvelle"}
                  </Text>
                </View>
                <Text style={styles.cardDescription} numberOfLines={2}>
                  {notification.body}
                </Text>
                <NativeButton
                  onPress={() => void markNotificationRead(notification)}
                  variant="secondary"
                >
                  Ouvrir
                </NativeButton>
              </NativeGlassCard>
            ))
          )}
        </View>
      ) : tab === "insights" ? (
        <View style={styles.stack}>
          <Text style={styles.cardTitle}>Mes tendances personnelles</Text>
          <Text style={styles.cardDescription}>
            Seulement vos propres activités de fidélité, challenges et habitudes sont utilisées.
          </Text>
          {(personalAnalytics?.items ?? []).length === 0 ? (
            <Text style={styles.cardDescription}>
              Pas encore assez d’activité sur les 90 derniers jours.
            </Text>
          ) : (
            personalAnalytics?.items.map((item) => (
              <NativeGlassCard key={item.metric}>
                <Text style={styles.eyebrow}>{item.metric.toUpperCase()}</Text>
                <Text style={styles.smallMetric}>{item.value}</Text>
                <Text style={styles.cardDescription}>
                  Évolution :{" "}
                  {item.changeRate == null
                    ? "base insuffisante"
                    : `${(item.changeRate * 100).toFixed(1)} %`}
                </Text>
              </NativeGlassCard>
            ))
          )}
          <NativeButton
            disabled={dataState === "saving" || !personalAnalytics?.items.length}
            onPress={() => void loadPersonalRecommendation()}
          >
            Obtenir une recommandation de récompense
          </NativeButton>
          {personalRecommendation && (
            <NativeGlassCard>
              <Text style={styles.itemTitle}>{personalRecommendation.summary}</Text>
              <Text style={styles.positivePoints}>
                Confiance {(personalRecommendation.confidence * 100).toFixed(0)} %
              </Text>
              <Text style={styles.cardDescription}>{personalRecommendation.uncertainty}</Text>
              {personalRecommendation.recommendations.map((item) => (
                <Text key={item} style={styles.cardDescription}>
                  • {item}
                </Text>
              ))}
            </NativeGlassCard>
          )}
        </View>
      ) : tab === "communication" ? (
        <View style={styles.stack}>
          <Text style={styles.cardTitle}>Préférences de communication</Text>
          <Text style={styles.cardDescription}>
            Gérez chaque canal marketing. Les heures calmes sont appliquées dans votre fuseau
            horaire.
          </Text>
          {(["EMAIL", "PUSH", "SMS", "IN_APP"] as const).map((channel) => {
            const preference = communicationPreferences.find(
              (item) => item.channel === channel && item.category === "MARKETING",
            );
            const optedIn = preference?.optedIn ?? true;
            return (
              <NativeGlassCard key={channel}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{channel}</Text>
                  <Text style={optedIn ? styles.positivePoints : styles.negativePoints}>
                    {optedIn ? "Activé" : "Désactivé"}
                  </Text>
                </View>
                <Text style={styles.cardDescription}>
                  Heures calmes : {preference?.quietHoursStart ?? "22:00"}–
                  {preference?.quietHoursEnd ?? "08:00"}
                  {" · "}
                  {preference?.timezone ?? "Europe/Paris"}
                </Text>
                <NativeButton
                  disabled={dataState === "saving"}
                  onPress={() => void toggleCommunicationPreference(channel)}
                  variant="secondary"
                >
                  {optedIn ? "Désactiver" : "Activer"}
                </NativeButton>
              </NativeGlassCard>
            );
          })}
        </View>
      ) : (
        <NativeGlassCard>
          <Image
            accessibilityLabel="Avatar du profil client"
            resizeMode="cover"
            source={avatarAsset(profileAvatar)}
            style={styles.profileAvatar}
          />
          <Text style={styles.cardTitle}>Profil et préférences</Text>
          <Text style={styles.profileLabel}>Photo de profil</Text>
          <View style={styles.avatarChoices}>
            {(["default", "woman", "man", "merchant"] as const).map((avatar) => (
              <Pressable
                accessibilityLabel={`Choisir l’avatar ${avatar}`}
                accessibilityRole="button"
                key={avatar}
                onPress={() => setProfileAvatar(avatar)}
                style={[styles.avatarChoice, profileAvatar === avatar && styles.avatarChoiceActive]}
              >
                <Image
                  resizeMode="cover"
                  source={avatarAsset(avatar)}
                  style={styles.avatarChoiceImage}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.profileLabel}>Nom affiché</Text>
          <TextInput
            onChangeText={setProfileName}
            placeholder="Nom et prénom"
            style={styles.profileInput}
            value={profileName}
          />
          <Text style={styles.profileLabel}>Téléphone</Text>
          <TextInput
            keyboardType="phone-pad"
            onChangeText={setProfilePhone}
            placeholder="Numéro de téléphone"
            style={styles.profileInput}
            value={profilePhone}
          />
          <Text style={styles.profileLabel}>Devise préférée</Text>
          <View style={styles.currencyRow}>
            {(["TND", "EUR", "USD", "AED"] as const).map((currency) => (
              <Pressable
                key={currency}
                onPress={() => setProfileCurrency(currency)}
                style={[
                  styles.currencyChoice,
                  profileCurrency === currency && styles.currencyChoiceActive,
                ]}
              >
                <Text
                  style={
                    profileCurrency === currency
                      ? styles.currencyChoiceTextActive
                      : styles.currencyChoiceText
                  }
                >
                  {currency}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.profileLabel}>Langue de l’application</Text>
          <View style={styles.currencyRow}>
            {(
              [
                ["fr-TN", "Français"],
                ["en", "English"],
                ["ar-TN", "العربية"],
              ] as const
            ).map(([locale, label]) => (
              <Pressable
                key={locale}
                onPress={() => setProfileLocale(locale)}
                style={[
                  styles.currencyChoice,
                  profileLocale === locale && styles.currencyChoiceActive,
                ]}
              >
                <Text
                  style={
                    profileLocale === locale
                      ? styles.currencyChoiceTextActive
                      : styles.currencyChoiceText
                  }
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.cardDescription}>{customer?.email ?? "Email non renseigné"}</Text>
          <NativeButton disabled={dataState === "saving"} onPress={() => void saveProfile()}>
            Enregistrer le profil
          </NativeButton>
          <View style={styles.profileDivider} />
          <Text style={styles.itemTitle}>Parrainage</Text>
          <Text style={styles.referralCode}>{referral?.code ?? "Création du code…"}</Text>
          <Text style={styles.cardDescription}>
            Partagez ce code : vous gagnez chacun {referral?.rewardPoints ?? 100} points après
            inscription. {referral?.rewarded ?? 0} ami(s) récompensé(s).
          </Text>
          <View style={styles.profileDivider} />
          <Text style={styles.itemTitle}>Protection du compte</Text>
          <Text style={styles.cardDescription}>
            Double authentification : {twoFactorEnabled ? "activée" : "non activée"}
          </Text>
          {!twoFactorEnabled ? (
            <NativeButton
              disabled={dataState === "saving"}
              onPress={() => void enableTwoFactor()}
              variant="secondary"
            >
              Activer la double authentification
            </NativeButton>
          ) : null}
          <View style={styles.profileDivider} />
          <Text style={styles.cardDescription}>
            Notifications push :{" "}
            {customer?.communicationPreferences.push ? "activées" : "désactivées"}
          </Text>
          <NativeButton
            disabled={dataState === "saving"}
            onPress={() => void togglePushPreference()}
          >
            Modifier les notifications push
          </NativeButton>
          <Text style={styles.cardDescription}>
            Consentement fidélité :{" "}
            {consentGranted(customer?.consents.loyalty) ? "accordé" : "non accordé"}
            {" · "}Marketing :{" "}
            {consentGranted(customer?.consents.marketing) ? "accordé" : "non accordé"}
          </Text>
        </NativeGlassCard>
      )}
      <View style={styles.sessionActions}>
        <NativeButton disabled={refreshing} onPress={onRefresh} variant="secondary">
          {refreshing ? "Actualisation…" : "Actualiser la session"}
        </NativeButton>
        <NativeButton onPress={onSignOut} variant="secondary">
          Se déconnecter
        </NativeButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: "center",
  },
  login: {
    flex: 1,
    gap: 28,
    justifyContent: "space-between",
    paddingBottom: 10,
    paddingTop: 10,
  },
  editorial: {
    gap: 12,
    maxWidth: 520,
  },
  loginIllustration: {
    alignSelf: "center",
    borderRadius: 24,
    height: 190,
    maxWidth: 360,
    width: "100%",
  },
  eyebrow: {
    color: "#65dcb5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  hero: {
    color: "#f2fbf8",
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -2.1,
    lineHeight: 46,
  },
  description: {
    color: "rgba(231,247,242,.66)",
    fontSize: 16,
    lineHeight: 24,
  },
  cardTitle: {
    color: "#f3fbf8",
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.9,
    marginBottom: 8,
  },
  cardDescription: {
    color: "rgba(229,246,241,.62)",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  error: {
    color: "#ff9b8d",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  recovery: {
    color: "rgba(229,246,241,.42)",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 18,
    textAlign: "center",
  },
  protected: {
    paddingBottom: 24,
    paddingTop: 10,
  },
  protectedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerAvatar: {
    borderColor: "rgba(101,220,181,.5)",
    borderRadius: 24,
    borderWidth: 2,
    height: 42,
    marginLeft: "auto",
    marginRight: 10,
    width: 42,
  },
  securePill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.08)",
    borderColor: "rgba(255,255,255,.13)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  secureDot: {
    backgroundColor: "#4bd5a7",
    borderRadius: 99,
    height: 6,
    width: 6,
  },
  secureText: {
    color: "#bcebdc",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  welcome: {
    color: "#f2fbf8",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1.6,
    marginTop: 42,
  },
  bento: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
    marginTop: 26,
  },
  heroCard: {
    minHeight: 205,
    width: "100%",
  },
  halfCard: {
    flexGrow: 1,
    minHeight: 165,
    width: "47%",
  },
  metric: {
    color: "#f1fbf7",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -2,
    marginTop: 48,
  },
  smallMetric: {
    color: "#f1fbf7",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.2,
    marginTop: 35,
  },
  tabs: {
    gap: 8,
    paddingBottom: 20,
    paddingTop: 22,
  },
  notice: {
    color: "#8ee7c8",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  stack: {
    gap: 12,
    marginTop: 18,
  },
  sectionAsset: {
    alignSelf: "flex-end",
    height: 64,
    width: 64,
  },
  sectionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  qrCard: {
    alignItems: "center",
    gap: 14,
    marginTop: 18,
  },
  qrSurface: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  itemTitle: {
    color: "#f3fbf8",
    flexShrink: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  positivePoints: {
    color: "#65dcb5",
    fontSize: 18,
    fontWeight: "900",
  },
  negativePoints: {
    color: "#ff9b8d",
    fontSize: 18,
    fontWeight: "900",
  },
  rewardCost: {
    color: "#8ee7c8",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 16,
  },
  progressTrack: {
    backgroundColor: "rgba(255,255,255,.1)",
    borderRadius: 99,
    height: 9,
    marginBottom: 14,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    backgroundColor: "#65dcb5",
    borderRadius: 99,
    height: 9,
  },
  celebration: {
    alignItems: "center",
    borderColor: "rgba(255,211,112,.42)",
    gap: 8,
  },
  celebrationIcon: {
    fontSize: 42,
  },
  calendar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  calendarDay: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,.06)",
    borderColor: "rgba(255,255,255,.1)",
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  calendarDayCompleted: {
    backgroundColor: "rgba(75,213,167,.28)",
    borderColor: "rgba(101,220,181,.6)",
  },
  calendarText: {
    color: "#e6f8f2",
    fontSize: 12,
    fontWeight: "800",
  },
  earnedBadge: {
    borderColor: "rgba(255,211,112,.4)",
  },
  badgeMedal: {
    alignSelf: "flex-end",
    height: 58,
    marginBottom: 8,
    width: 58,
  },
  rankMedal: {
    borderRadius: 18,
    height: 42,
    width: 42,
  },
  rank: {
    color: "#ffd370",
    fontSize: 20,
    fontWeight: "900",
    minWidth: 42,
  },
  sessionActions: {
    gap: 10,
    marginTop: 28,
  },
  spacer: {
    height: 10,
  },
  scopeNotice: {
    color: "rgba(229,246,241,.4)",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 20,
    textAlign: "center",
  },
  profileAvatar: {
    alignSelf: "center",
    borderColor: "rgba(101,220,181,.45)",
    borderRadius: 52,
    borderWidth: 2,
    height: 104,
    marginBottom: 18,
    width: 104,
  },
  avatarChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 10,
  },
  avatarChoice: {
    borderColor: "rgba(255,255,255,.18)",
    borderRadius: 24,
    borderWidth: 2,
    padding: 2,
  },
  avatarChoiceActive: {
    borderColor: "#60a5fa",
    shadowColor: "#2563eb",
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  avatarChoiceImage: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  profileLabel: {
    color: "rgba(229,246,241,.72)",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  profileInput: {
    backgroundColor: "rgba(255,255,255,.08)",
    borderColor: "rgba(255,255,255,.16)",
    borderRadius: 12,
    borderWidth: 1,
    color: "#f4fffb",
    fontSize: 15,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profileDivider: {
    backgroundColor: "rgba(255,255,255,.12)",
    height: 1,
    marginVertical: 18,
  },
  referralCode: {
    color: "#ffd370",
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: 2,
    marginVertical: 8,
  },
  currencyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 },
  currencyChoice: {
    borderColor: "rgba(255,255,255,.18)",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currencyChoiceActive: { backgroundColor: "#2563eb", borderColor: "#60a5fa" },
  currencyChoiceText: { color: "rgba(229,246,241,.65)", fontWeight: "800" },
  currencyChoiceTextActive: { color: "#ffffff", fontWeight: "900" },
  activityArrow: {
    color: "#2563eb",
    fontSize: 27,
    fontWeight: "500",
  },
  activityCopy: {
    flex: 1,
  },
  activityDetail: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },
  activityDot: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    height: 9,
    width: 9,
  },
  activityMenu: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe3ef",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  activityRow: {
    alignItems: "center",
    borderBottomColor: "#edf1f7",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  activityTitle: {
    color: "#172033",
    fontSize: 15,
    fontWeight: "800",
  },
  balanceCard: {
    alignItems: "center",
    backgroundColor: "#1d4ed8",
    borderRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 148,
    overflow: "hidden",
    padding: 20,
  },
  balanceEyebrow: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  balanceHint: {
    color: "#dbeafe",
    fontSize: 12,
    marginTop: 5,
  },
  balanceLine: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 8,
    marginTop: 5,
  },
  balanceMetric: {
    color: "#ffffff",
    fontSize: 43,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  balanceUnit: {
    color: "#dbeafe",
    fontSize: 15,
    fontWeight: "800",
  },
  gamePromo: {
    alignItems: "center",
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    borderRadius: 24,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
    padding: 15,
  },
  gamePromoCopy: {
    flex: 1,
    gap: 6,
  },
  gamePromoEyebrow: {
    color: "#c2410c",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  gamePromoImage: {
    height: 130,
    width: 130,
  },
  gamePromoText: {
    color: "#7c2d12",
    fontSize: 12,
    lineHeight: 17,
  },
  gamePromoTitle: {
    color: "#431407",
    fontSize: 21,
    fontWeight: "900",
  },
  homeSectionTitle: {
    color: "#f3fbf8",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
  },
  homeStack: {
    gap: 14,
    marginTop: 18,
  },
  instantWinBanner: {
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
  },
  instantWinCopy: {
    flex: 1,
  },
  instantWinEyebrow: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  instantWinIcon: {
    color: "#d97706",
    fontSize: 30,
  },
  instantWinTitle: {
    color: "#451a03",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },
  quickBlue: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  quickCard: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 130,
    padding: 15,
  },
  quickGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickIcon: {
    color: "#2563eb",
    fontSize: 29,
    fontWeight: "900",
  },
  quickText: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 5,
  },
  quickTitle: {
    color: "#172033",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 13,
  },
  quickYellow: {
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
  },
});
