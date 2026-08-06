export type PrizeTemplateType = "POINTS" | "REWARD" | "DISCOUNT" | "TRY_AGAIN";

export interface PrizeTemplate {
  readonly code: string;
  readonly label: string;
  readonly type: PrizeTemplateType;
  readonly points: number;
  readonly probabilityWeight: number;
  readonly color: string;
}

/**
 * Culturally-adapted starting points for a new game's prize table.
 *
 * These are suggestions a merchant sees when creating a game, not a constraint on what they can
 * configure -- `POST /v1/games/:id/prizes` accepts any prize table regardless of region. The
 * difference by `rewardStyle` is deliberately concrete and checkable, not cosmetic: reward-weighted
 * styles carry real REWARD/DISCOUNT slots and a lower TRY_AGAIN share, so the suggested table itself
 * changes shape, not just its labels.
 *
 * `rewardStyle` values are free text set by whoever configures `PlatformRegion.culturalProfile`
 * (seeded today, editable through the regions API). New styles fall back to a neutral points-led
 * mix rather than failing, since the field is operator-authored and not a closed enum.
 */
const TEMPLATES: Readonly<Record<string, readonly PrizeTemplate[]>> = {
  "family-and-value": [
    {
      code: "POINTS-SMALL",
      label: "50 points",
      type: "POINTS",
      points: 50,
      probabilityWeight: 35,
      color: "#16a394",
    },
    {
      code: "POINTS-MED",
      label: "150 points",
      type: "POINTS",
      points: 150,
      probabilityWeight: 20,
      color: "#0d8a7d",
    },
    {
      code: "POINTS-BIG",
      label: "400 points",
      type: "POINTS",
      points: 400,
      probabilityWeight: 8,
      color: "#0a6a60",
    },
    {
      code: "TRY-AGAIN",
      label: "Rejouez bientôt",
      type: "TRY_AGAIN",
      points: 0,
      probabilityWeight: 37,
      color: "#c7c1b6",
    },
  ],
  "premium-and-hospitality": [
    {
      code: "POINTS-MED",
      label: "200 points",
      type: "POINTS",
      points: 200,
      probabilityWeight: 25,
      color: "#e5a13c",
    },
    {
      code: "DISCOUNT-10",
      label: "-10 %",
      type: "DISCOUNT",
      points: 0,
      probabilityWeight: 20,
      color: "#c8452f",
    },
    {
      code: "REWARD-SIGNATURE",
      label: "Article signature offert",
      type: "REWARD",
      points: 0,
      probabilityWeight: 10,
      color: "#6d28d9",
    },
    {
      code: "TRY-AGAIN",
      label: "Une prochaine fois",
      type: "TRY_AGAIN",
      points: 0,
      probabilityWeight: 45,
      color: "#c7c1b6",
    },
  ],
  "premium-and-sustainable": [
    {
      code: "POINTS-MED",
      label: "150 points",
      type: "POINTS",
      points: 150,
      probabilityWeight: 30,
      color: "#16a394",
    },
    {
      code: "DISCOUNT-15",
      label: "-15 %",
      type: "DISCOUNT",
      points: 0,
      probabilityWeight: 15,
      color: "#c8452f",
    },
    {
      code: "REWARD-ECO",
      label: "Attention éco-responsable",
      type: "REWARD",
      points: 0,
      probabilityWeight: 10,
      color: "#0d8a7d",
    },
    {
      code: "TRY-AGAIN",
      label: "Merci de votre visite",
      type: "TRY_AGAIN",
      points: 0,
      probabilityWeight: 45,
      color: "#c7c1b6",
    },
  ],
};

const DEFAULT_TEMPLATE: readonly PrizeTemplate[] = [
  {
    code: "POINTS-SMALL",
    label: "50 points",
    type: "POINTS",
    points: 50,
    probabilityWeight: 30,
    color: "#16a394",
  },
  {
    code: "POINTS-MED",
    label: "150 points",
    type: "POINTS",
    points: 150,
    probabilityWeight: 15,
    color: "#0d8a7d",
  },
  {
    code: "TRY-AGAIN",
    label: "Try again",
    type: "TRY_AGAIN",
    points: 0,
    probabilityWeight: 55,
    color: "#c7c1b6",
  },
];

export function suggestPrizeTemplates(rewardStyle: string | undefined): readonly PrizeTemplate[] {
  if (!rewardStyle) return DEFAULT_TEMPLATE;
  return TEMPLATES[rewardStyle] ?? DEFAULT_TEMPLATE;
}
