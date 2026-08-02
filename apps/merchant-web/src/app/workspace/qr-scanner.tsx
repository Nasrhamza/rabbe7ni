"use client";

import { Button, Icon, StatusPill } from "@rabbehni/design-system/web";
import { useEffect, useRef, useState, type FormEvent } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type CatalogItem = Readonly<Record<string, unknown>>;
type ScanAction = "EARN" | "INSTANT" | "REDEEM";
type QrScanResponse = Readonly<{
  outcome?: Readonly<{ kind: "POINTS" | "REWARD"; label: string }>;
}>;
type DetectedBarcode = Readonly<{ rawValue: string }>;
type BarcodeDetectorInstance = {
  detect(source: unknown): Promise<readonly DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = new (options?: {
  formats?: readonly string[];
}) => BarcodeDetectorInstance;

function label(item: CatalogItem): string {
  const value = item.name ?? item.displayName ?? item.code ?? item.id;
  return typeof value === "string" ? value : "Élément";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}/v1${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Erreur HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function barcodeDetector(): BarcodeDetectorInstance | null {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
  return Detector ? new Detector({ formats: ["qr_code"] }) : null;
}

export function QrScannerPanel() {
  const [action, setAction] = useState<ScanAction>("EARN");
  const [branches, setBranches] = useState<readonly CatalogItem[]>([]);
  const [programs, setPrograms] = useState<readonly CatalogItem[]>([]);
  const [rewards, setRewards] = useState<readonly CatalogItem[]>([]);
  const [branchId, setBranchId] = useState("");
  const [programId, setProgramId] = useState("");
  const [rewardId, setRewardId] = useState("");
  const [points, setPoints] = useState("10");
  const [token, setToken] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [state, setState] = useState<"error" | "idle" | "scanning" | "success">("idle");
  const [message, setMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCatalogs() {
      try {
        const [branchResponse, programResponse, rewardResponse] = await Promise.all([
          request<{ items: readonly CatalogItem[] }>("/branches?pageSize=100"),
          request<{ items: readonly CatalogItem[] }>("/loyalty-programs?pageSize=100"),
          request<{ items: readonly CatalogItem[] }>("/rewards?pageSize=100"),
        ]);
        if (!active) return;
        setBranches(branchResponse.items);
        setPrograms(programResponse.items);
        setRewards(rewardResponse.items);
        setBranchId(String(branchResponse.items[0]?.id ?? ""));
        setProgramId(String(programResponse.items[0]?.id ?? ""));
        setRewardId(String(rewardResponse.items[0]?.id ?? ""));
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Catalogues indisponibles");
      }
    }
    void loadCatalogs();
    return () => {
      active = false;
      stopCamera();
    };
  }, []);

  function stopCamera() {
    if (scanTimerRef.current !== null) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setState((current) => (current === "scanning" ? "idle" : current));
  }

  function acceptDetectedToken(value: string) {
    setToken(value.trim());
    setMessage("QR détecté. Vérifiez l’opération puis confirmez.");
    setState("idle");
    stopCamera();
  }

  async function startCamera() {
    setMessage("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error");
      setMessage("La caméra n’est pas disponible. Importez une image QR ou collez le code.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setState("scanning");
      const detector = barcodeDetector();
      if (!detector) {
        setMessage(
          "Caméra ouverte. Ce navigateur ne détecte pas automatiquement le QR : utilisez l’import d’image si nécessaire.",
        );
        return;
      }
      scanTimerRef.current = window.setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        void detector
          .detect(video)
          .then((codes) => {
            const value = codes[0]?.rawValue;
            if (value) acceptDetectedToken(value);
          })
          .catch(() => undefined);
      }, 450);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? `Caméra inaccessible : ${error.message}`
          : "Autorisation caméra refusée.",
      );
      stopCamera();
    }
  }

  async function scanImage(file: File | undefined) {
    if (!file) return;
    const detector = barcodeDetector();
    if (!detector) {
      setState("error");
      setMessage("La lecture d’image QR n’est pas prise en charge par ce navigateur.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const value = codes[0]?.rawValue;
      if (!value) throw new Error("Aucun QR détecté dans cette image");
      acceptDetectedToken(value);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Image QR illisible");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (token.trim().length < 40) {
      setState("error");
      setMessage("Scannez ou collez d’abord un QR client valide.");
      return;
    }
    setState("scanning");
    try {
      const payload = {
        token: token.trim(),
        action,
        idempotencyKey: `merchant-web:${crypto.randomUUID()}`,
        ...(branchId ? { branchId } : {}),
        ...(action === "EARN"
          ? { points: Number(points), programId }
          : action === "INSTANT"
            ? { programId }
            : { quantity: 1, rewardId }),
        metadata: { source: "merchant-web-scanner" },
      };
      const result = await request<QrScanResponse>("/qr/scan", {
        body: JSON.stringify(payload),
        method: "POST",
      });
      setState("success");
      setMessage(
        action === "EARN"
          ? `${points} points attribués avec succès.`
          : action === "INSTANT"
            ? `Surprise gagnée : ${result.outcome?.label ?? "récompense instantanée"}.`
            : "Récompense validée avec succès.",
      );
      setToken("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Le scan a été refusé");
    }
  }

  return (
    <section className="r-qr-scanner" id="qr-scanner">
      <header>
        <div>
          <span className="r-eyebrow">Opération en point de vente</span>
          <h3>Scanner le QR d’un client</h3>
          <p>
            Scannez, choisissez l’action puis confirmez. Chaque opération est sécurisée et tracée.
          </p>
        </div>
        <StatusPill tone={cameraActive ? "success" : "neutral"}>
          {cameraActive ? "Caméra active" : "Prêt"}
        </StatusPill>
      </header>

      <div className="r-qr-scanner__layout">
        <div className="r-qr-camera">
          <video muted playsInline ref={videoRef} />
          {!cameraActive && (
            <div className="r-qr-camera__placeholder">
              <span>
                <Icon name="qr" />
              </span>
              <strong>Placez le QR dans le cadre</strong>
              <small>La caméra ne démarre qu’après votre autorisation.</small>
            </div>
          )}
          <div className="r-qr-camera__frame" aria-hidden="true" />
          <div className="r-qr-camera__actions">
            <Button
              onClick={() => void (cameraActive ? stopCamera() : startCamera())}
              type="button"
            >
              {cameraActive ? "Arrêter la caméra" : "Démarrer la caméra"}
            </Button>
            <label>
              Importer une image
              <input
                accept="image/*"
                onChange={(event) => void scanImage(event.target.files?.[0])}
                type="file"
              />
            </label>
          </div>
        </div>

        <form className="r-qr-operation" onSubmit={submit}>
          <ol className="r-qr-steps">
            <li className={token ? "is-done" : "is-current"}>
              <span>1</span> Scanner
            </li>
            <li className={token ? "is-current" : ""}>
              <span>2</span> Configurer
            </li>
            <li>
              <span>3</span> Confirmer
            </li>
          </ol>

          <div className="r-qr-action-switch" role="group" aria-label="Type d’opération">
            <button
              aria-pressed={action === "EARN"}
              onClick={() => setAction("EARN")}
              type="button"
            >
              <Icon name="points" /> Attribuer des points
            </button>
            <button
              aria-pressed={action === "INSTANT"}
              onClick={() => setAction("INSTANT")}
              type="button"
            >
              <Icon name="gamification" /> Surprise instantanée
            </button>
            <button
              aria-pressed={action === "REDEEM"}
              onClick={() => setAction("REDEEM")}
              type="button"
            >
              <Icon name="reward" /> Utiliser une récompense
            </button>
          </div>

          <label>
            <span>Point de vente</span>
            <select onChange={(event) => setBranchId(event.target.value)} value={branchId}>
              {branches.map((item) => (
                <option key={String(item.id)} value={String(item.id)}>
                  {label(item)}
                </option>
              ))}
            </select>
          </label>

          {action === "EARN" ? (
            <div className="r-qr-operation__row">
              <label>
                <span>Programme de fidélité</span>
                <select onChange={(event) => setProgramId(event.target.value)} value={programId}>
                  {programs.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Nombre de points</span>
                <input
                  min="1"
                  onChange={(event) => setPoints(event.target.value)}
                  type="number"
                  value={points}
                />
              </label>
            </div>
          ) : action === "INSTANT" ? (
            <div className="r-qr-instant">
              <label>
                <span>Programme de fidélité</span>
                <select onChange={(event) => setProgramId(event.target.value)} value={programId}>
                  {programs.map((item) => (
                    <option key={String(item.id)} value={String(item.id)}>
                      {label(item)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="r-qr-instant__notice">
                <strong>Résultat automatique et sécurisé</strong>
                <span>Le client gagnera des points, un cadeau ou une remise disponible.</span>
              </div>
            </div>
          ) : (
            <label>
              <span>Récompense</span>
              <select onChange={(event) => setRewardId(event.target.value)} value={rewardId}>
                {rewards.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {label(item)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <details className="r-qr-manual">
            <summary>Saisie manuelle de secours</summary>
            <label>
              <span>Token QR signé</span>
              <textarea
                onChange={(event) => setToken(event.target.value)}
                placeholder="Collez le contenu du QR uniquement si la caméra est indisponible"
                rows={3}
                value={token}
              />
            </label>
          </details>

          {message && (
            <div
              className={`r-qr-feedback r-qr-feedback--${state}`}
              role={state === "error" ? "alert" : "status"}
            >
              {message}
            </div>
          )}

          <Button disabled={state === "scanning" || token.trim().length < 40} type="submit">
            {state === "scanning"
              ? "Vérification…"
              : action === "EARN"
                ? "Confirmer l’attribution"
                : action === "INSTANT"
                  ? "Révéler la surprise"
                  : "Confirmer la récompense"}
          </Button>
        </form>
      </div>
    </section>
  );
}
