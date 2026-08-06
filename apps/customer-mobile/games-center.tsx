import { useRef, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { Confetti, MysteryBox, PrizeWheel, ScratchCard, pulse } from "./game-visuals";
import scratchCard from "./assets/rabbehni/gamification/icon-scratch-card.png";
import trophy from "./assets/rabbehni/gamification/icon-win-trophy.png";

export type GameCode = "MYSTERY_BOX" | "SCRATCH_CARD" | "SPIN_WHEEL";

export interface CustomerGame {
  readonly code: GameCode;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly eligible: boolean;
  readonly nextAvailableAt: string | null;
  readonly prizes: readonly {
    readonly code: string;
    readonly label: string;
    readonly points: number;
    readonly color: string;
  }[];
}

export interface GamePlayResult {
  readonly playId: string;
  readonly gameCode: GameCode;
  readonly prize: {
    readonly code: string;
    readonly label: string;
    readonly points: number;
    readonly color: string;
  };
  readonly balance?: number;
}

export interface GameHistoryItem {
  readonly id: string;
  readonly gameCode: GameCode;
  readonly prizeLabel: string;
  readonly points: number;
  readonly playedAt: string;
}

export interface CustomerGamesPayload {
  readonly games: readonly CustomerGame[];
  readonly history: readonly GameHistoryItem[];
}

function availability(game?: CustomerGame): string {
  if (!game) return "Indisponible";
  if (game.eligible) return "Disponible maintenant";
  if (!game.nextAvailableAt) return "Revenez bientôt";
  return `Disponible à ${new Date(game.nextAvailableAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function PrizeReveal({ result, onClose }: { result: GamePlayResult; onClose: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.resultCard}>
      <Confetti />
      <Image resizeMode="contain" source={trophy} style={styles.resultImage} />
      <Text style={styles.resultEyebrow}>FÉLICITATIONS</Text>
      <Text style={styles.resultTitle}>{result.prize.label}</Text>
      <Text style={styles.resultCopy}>
        {result.prize.points > 0
          ? "Vos points ont été ajoutés immédiatement à votre solde."
          : "Une nouvelle surprise vous attend à la prochaine partie."}
      </Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.darkButton}>
        <Text style={styles.darkButtonText}>Continuer</Text>
      </Pressable>
    </View>
  );
}

export function GamesCenter({
  balance,
  games,
  loading,
  onPlay,
}: Readonly<{
  balance: number;
  games?: CustomerGamesPayload | undefined;
  loading: boolean;
  onPlay: (code: GameCode) => Promise<GamePlayResult>;
}>) {
  const wheel = games?.games.find((game) => game.code === "SPIN_WHEEL");
  const scratch = games?.games.find((game) => game.code === "SCRATCH_CARD");
  const box = games?.games.find((game) => game.code === "MYSTERY_BOX");
  const [spinTarget, setSpinTarget] = useState<number>();
  const pendingWheelResult = useRef<GamePlayResult | undefined>(undefined);
  const [activeGame, setActiveGame] = useState<GameCode>("SPIN_WHEEL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GamePlayResult>();
  const [scratchResult, setScratchResult] = useState<GamePlayResult>();
  const scratchResultRef = useRef<GamePlayResult | undefined>(undefined);
  const [boxOpened, setBoxOpened] = useState(false);

  async function spin() {
    if (!wheel?.eligible || busy) return;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const played = await onPlay("SPIN_WHEEL");
      // The server is the authority on the prize; the wheel is told which segment to stop on so
      // what the player sees under the pointer matches what they were actually awarded.
      const prizeIndex = Math.max(
        0,
        wheel.prizes.findIndex((prize) => prize.code === played.prize.code),
      );
      pendingWheelResult.current = played;
      pulse("tick");
      setSpinTarget(prizeIndex);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La roue est indisponible.");
      setBusy(false);
    }
  }

  async function prepareScratch() {
    if (!scratch?.eligible || busy) return;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const played = await onPlay("SCRATCH_CARD");
      scratchResultRef.current = played;
      setScratchResult(played);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "La carte est indisponible.");
    } finally {
      setBusy(false);
    }
  }

  async function openMysteryBox() {
    if (!box?.eligible || busy) return;
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      const played = await onPlay("MYSTERY_BOX");
      // Let the lid animation play out before the prize card replaces the box.
      setBoxOpened(true);
      setTimeout(() => {
        setResult(played);
        setBusy(false);
        setBoxOpened(false);
      }, 900);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le coffre est indisponible.");
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>ESPACE JEUX</Text>
          <Text style={styles.heroTitle}>Jouez. Gagnez. Profitez.</Text>
          <Text style={styles.heroText}>
            Des surprises réelles ajoutées à votre compte Rabbehni.
          </Text>
        </View>
        <View style={styles.balancePill}>
          <Text style={styles.balanceValue}>{balance}</Text>
          <Text style={styles.balanceLabel}>POINTS</Text>
        </View>
      </View>

      <View style={styles.gameSwitch}>
        <Pressable
          onPress={() => setActiveGame("SPIN_WHEEL")}
          style={[styles.switchButton, activeGame === "SPIN_WHEEL" && styles.switchButtonActive]}
        >
          <Text style={activeGame === "SPIN_WHEEL" ? styles.switchTextActive : styles.switchText}>
            Roue
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveGame("SCRATCH_CARD")}
          style={[styles.switchButton, activeGame === "SCRATCH_CARD" && styles.switchButtonActive]}
        >
          <Text style={activeGame === "SCRATCH_CARD" ? styles.switchTextActive : styles.switchText}>
            À gratter
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveGame("MYSTERY_BOX")}
          style={[styles.switchButton, activeGame === "MYSTERY_BOX" && styles.switchButtonActive]}
        >
          <Text style={activeGame === "MYSTERY_BOX" ? styles.switchTextActive : styles.switchText}>
            Coffre
          </Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {result ? (
        <PrizeReveal
          onClose={() => {
            setResult(undefined);
            setScratchResult(undefined);
            scratchResultRef.current = undefined;
          }}
          result={result}
        />
      ) : activeGame === "SPIN_WHEEL" ? (
        <View style={styles.gameCard}>
          <View style={styles.cardHeading}>
            <View>
              <Text style={styles.gameTitle}>{wheel?.title ?? "Roue des cadeaux"}</Text>
              <Text style={wheel?.eligible ? styles.available : styles.waiting}>
                ● {availability(wheel)}
              </Text>
            </View>
            <Text style={styles.dailyBadge}>1 chance</Text>
          </View>
          <View style={styles.wheelStage}>
            <PrizeWheel
              onSettled={() => {
                if (pendingWheelResult.current) setResult(pendingWheelResult.current);
                pendingWheelResult.current = undefined;
                setSpinTarget(undefined);
                setBusy(false);
              }}
              prizes={
                wheel?.prizes.length
                  ? wheel.prizes
                  : [
                      { code: "a", label: "—", color: "#e5e0d8" },
                      { code: "b", label: "—", color: "#f2eee8" },
                    ]
              }
              spinning={spinTarget !== undefined}
              targetIndex={spinTarget}
            />
          </View>
          <Text style={styles.instructions}>Appuyez sur le bouton pour lancer la roue.</Text>
          <Pressable
            accessibilityRole="button"
            disabled={!wheel?.eligible || busy || loading}
            onPress={() => void spin()}
            style={({ pressed }) => [
              styles.primaryButton,
              (!wheel?.eligible || busy || loading) && styles.disabledButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>{busy ? "La roue tourne…" : "TOURNER"}</Text>
          </Pressable>
          <View style={styles.prizeStrip}>
            {(wheel?.prizes ?? []).slice(0, 5).map((prize) => (
              <View key={prize.code} style={[styles.prizeChip, { borderColor: prize.color }]}>
                <Text style={styles.prizeChipText}>{prize.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : activeGame === "SCRATCH_CARD" ? (
        <View style={styles.gameCard}>
          <View style={styles.cardHeading}>
            <View>
              <Text style={styles.gameTitle}>{scratch?.title ?? "Grattez & Gagnez"}</Text>
              <Text style={scratch?.eligible ? styles.available : styles.waiting}>
                ● {availability(scratch)}
              </Text>
            </View>
            <Image resizeMode="contain" source={scratchCard} style={styles.smallGameImage} />
          </View>
          {scratchResult ? (
            <View style={styles.scratchBoard}>
              <ScratchCard
                onRevealed={() => {
                  if (scratchResultRef.current) setResult(scratchResultRef.current);
                }}
              >
                <Text style={styles.scratchPrizeLabel}>VOTRE SURPRISE</Text>
                <Text style={styles.scratchPrizeValue}>{scratchResult.prize.label}</Text>
              </ScratchCard>
            </View>
          ) : (
            <View style={styles.scratchPreview}>
              <Image resizeMode="contain" source={scratchCard} style={styles.scratchPreviewImage} />
              <Text style={styles.instructions}>
                Préparez votre carte, puis passez le doigt pour révéler le gain.
              </Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={!scratch?.eligible || busy || loading || Boolean(scratchResult)}
            onPress={() => void prepareScratch()}
            style={[
              styles.primaryButton,
              (!scratch?.eligible || busy || loading || Boolean(scratchResult)) &&
                styles.disabledButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {scratchResult ? "GRATTEZ LA CARTE" : busy ? "PRÉPARATION…" : "JOUER"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.gameCard}>
          <View style={styles.cardHeading}>
            <View style={styles.boxHeadingCopy}>
              <Text style={styles.gameTitle}>{box?.title ?? "Coffre mystère"}</Text>
              <Text style={box?.eligible ? styles.available : styles.waiting}>
                ● {availability(box)}
              </Text>
            </View>
            <Text style={styles.dailyBadge}>1 ouverture</Text>
          </View>
          <View style={styles.boxStage}>
            <View style={styles.boxGlow} />
            <MysteryBox opened={boxOpened} opening={busy && !boxOpened} />
          </View>
          <Text style={styles.instructions}>
            Le serveur choisit la surprise selon les probabilités configurées par le commerce.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!box?.eligible || busy || loading}
            onPress={() => void openMysteryBox()}
            style={[
              styles.primaryButton,
              (!box?.eligible || busy || loading) && styles.disabledButton,
            ]}
          >
            <Text style={styles.primaryButtonText}>{busy ? "OUVERTURE…" : "OUVRIR LE COFFRE"}</Text>
          </Pressable>
          <View style={styles.prizeStrip}>
            {(box?.prizes ?? []).slice(0, 5).map((prize) => (
              <View key={prize.code} style={[styles.prizeChip, { borderColor: prize.color }]}>
                <Text style={styles.prizeChipText}>{prize.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {(games?.history.length ?? 0) > 0 ? (
        <View style={styles.historyCard}>
          <Text style={styles.historyTitle}>Mes derniers gains</Text>
          {games?.history.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.historyRow}>
              <Text style={styles.historyIcon}>{item.gameCode === "SPIN_WHEEL" ? "◉" : "▧"}</Text>
              <View style={styles.historyCopy}>
                <Text style={styles.historyLabel}>{item.prizeLabel}</Text>
                <Text style={styles.historyDate}>{new Date(item.playedAt).toLocaleString()}</Text>
              </View>
              <Text style={styles.historyPoints}>{item.points > 0 ? `+${item.points}` : "—"}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  available: { color: "#15803d", fontSize: 12, fontWeight: "800", marginTop: 6 },
  balanceLabel: { color: "#dbeafe", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  balancePill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.17)",
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 76,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  balanceValue: { color: "#ffffff", fontSize: 24, fontWeight: "900" },
  boxGlow: {
    backgroundColor: "rgba(124,58,237,0.14)",
    borderRadius: 90,
    height: 180,
    position: "absolute",
    width: 180,
  },
  boxHeadingCopy: { flex: 1, paddingRight: 10 },
  boxStage: { alignItems: "center", height: 220, justifyContent: "center" },
  cardHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dailyBadge: {
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  darkButton: {
    backgroundColor: "#172554",
    borderRadius: 14,
    marginTop: 18,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  darkButtonText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  disabledButton: { opacity: 0.45 },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 14,
    borderWidth: 1,
    color: "#b91c1c",
    fontWeight: "700",
    padding: 12,
  },
  gameCard: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe3ef",
    borderRadius: 24,
    borderWidth: 1,
    elevation: 3,
    padding: 18,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  gameSwitch: {
    backgroundColor: "#e8eef7",
    borderRadius: 16,
    flexDirection: "row",
    padding: 4,
  },
  gameTitle: { color: "#172033", fontSize: 21, fontWeight: "900" },
  hero: {
    alignItems: "center",
    backgroundColor: "#1d4ed8",
    borderRadius: 24,
    flexDirection: "row",
    gap: 14,
    justifyContent: "space-between",
    overflow: "hidden",
    padding: 20,
  },
  heroCopy: { flex: 1 },
  heroText: { color: "#dbeafe", fontSize: 13, lineHeight: 19, marginTop: 7 },
  heroTitle: { color: "#ffffff", fontSize: 25, fontWeight: "900", lineHeight: 30 },
  historyCard: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe3ef",
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  historyCopy: { flex: 1 },
  historyDate: { color: "#7c8799", fontSize: 11, marginTop: 2 },
  historyIcon: { color: "#2563eb", fontSize: 22, width: 34 },
  historyLabel: { color: "#1e293b", fontSize: 14, fontWeight: "700" },
  historyPoints: { color: "#15803d", fontSize: 16, fontWeight: "900" },
  historyRow: {
    alignItems: "center",
    borderTopColor: "#edf1f7",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingVertical: 12,
  },
  historyTitle: { color: "#172033", fontSize: 18, fontWeight: "900", marginBottom: 4 },
  instructions: { color: "#64748b", fontSize: 13, lineHeight: 19, textAlign: "center" },
  kicker: { color: "#bfdbfe", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  pressedButton: { transform: [{ scale: 0.98 }] },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#16a34a",
    borderRadius: 16,
    marginTop: 14,
    paddingVertical: 16,
  },
  primaryButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "900", letterSpacing: 0.7 },
  prizeChip: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  prizeChipText: { color: "#334155", fontSize: 10, fontWeight: "800" },
  prizeStrip: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 16 },
  resultCard: {
    alignItems: "center",
    backgroundColor: "#fefce8",
    borderColor: "#facc15",
    borderRadius: 24,
    borderWidth: 2,
    padding: 24,
  },
  resultCopy: { color: "#52525b", fontSize: 14, lineHeight: 21, textAlign: "center" },
  resultEyebrow: { color: "#a16207", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  resultImage: { height: 100, width: 100 },
  resultTitle: { color: "#713f12", fontSize: 31, fontWeight: "900", marginVertical: 8 },
  scratchBoard: {
    alignSelf: "center",
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
    borderRadius: 20,
    borderWidth: 2,
    height: 180,
    marginVertical: 18,
    overflow: "hidden",
    width: 300,
  },
  scratchPreview: { alignItems: "center", paddingVertical: 14 },
  scratchPreviewImage: { height: 155, width: 220 },
  scratchPrize: { alignItems: "center", flex: 1, justifyContent: "center" },
  scratchPrizeLabel: { color: "#92400e", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  scratchPrizeValue: { color: "#7c2d12", fontSize: 28, fontWeight: "900", marginTop: 7 },
  screen: { gap: 14 },
  smallGameImage: { height: 58, width: 70 },
  switchButton: { alignItems: "center", borderRadius: 13, flex: 1, paddingVertical: 11 },
  switchButtonActive: { backgroundColor: "#ffffff", elevation: 2 },
  switchText: { color: "#64748b", fontSize: 14, fontWeight: "700" },
  switchTextActive: { color: "#1d4ed8", fontSize: 14, fontWeight: "900" },
  waiting: { color: "#b45309", fontSize: 12, fontWeight: "800", marginTop: 6 },
  wheelStage: { alignItems: "center", height: 250, justifyContent: "center", marginTop: 6 },
});
