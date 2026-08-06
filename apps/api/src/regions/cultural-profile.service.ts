import { Inject, Injectable } from "@nestjs/common";
import { RegionStatus } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { TenantContextStore } from "../tenancy/tenant-context.store.js";

export interface CulturalProfile {
  readonly regionId: string;
  readonly regionCode: string;
  readonly countryCode: string;
  readonly locale: string;
  readonly currency: string;
  readonly timezone: string;
  readonly firstLanguage?: string;
  readonly secondaryLanguage?: string;
  readonly rewardStyle?: string;
}

/**
 * Resolves the cultural profile that governs a merchant's organization.
 *
 * `PlatformRegion.culturalProfile` has existed since Phase 9 -- writable through the regions API and
 * populated by the demonstration seed -- but nothing ever read it back. A merchant's games and reward
 * catalog looked identical whether the organization operated in Tunis or Dubai, so "adapt game
 * mechanics and rewards to region and culture" was a data column, not a behavior. This service is the
 * read side: given an organization, it walks organization -> country -> region and returns the
 * profile so callers (game defaults today, reward and notification tone later) can act on it.
 */
@Injectable()
export class CulturalProfileService {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  async resolveForOrganization(organizationId: string): Promise<CulturalProfile | null> {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const organization = await transaction.organization.findUnique({
        where: { id_tenantId: { id: organizationId, tenantId } },
        select: { countryCode: true },
      });
      if (!organization) return null;

      const country = await transaction.platformCountry.findUnique({
        where: { tenantId_code: { tenantId, code: organization.countryCode } },
      });
      if (!country) return null;

      // A country may in principle carry several regions; the oldest active one is the tenant's
      // canonical configuration for it, matching how the demonstration seed provisions one region
      // per country.
      const region = await transaction.platformRegion.findFirst({
        where: { tenantId, countryId: country.id, status: RegionStatus.ACTIVE },
        orderBy: { createdAt: "asc" },
      });
      if (!region) return null;

      const profile =
        region.culturalProfile && typeof region.culturalProfile === "object"
          ? (region.culturalProfile as Record<string, unknown>)
          : {};

      return {
        regionId: region.id,
        regionCode: region.code,
        countryCode: country.code,
        locale: region.locale,
        currency: region.currency,
        timezone: region.timezone,
        ...(typeof profile.firstLanguage === "string"
          ? { firstLanguage: profile.firstLanguage }
          : {}),
        ...(typeof profile.secondaryLanguage === "string"
          ? { secondaryLanguage: profile.secondaryLanguage }
          : {}),
        ...(typeof profile.rewardStyle === "string" ? { rewardStyle: profile.rewardStyle } : {}),
      };
    });
  }
}
