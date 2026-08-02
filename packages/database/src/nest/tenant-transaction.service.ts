import { Inject, Injectable } from "@nestjs/common";

import { TenantTransactionManager } from "../tenant-transaction.js";
import { PrismaService } from "./prisma.service.js";

@Injectable()
export class TenantTransactionService extends TenantTransactionManager {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }
}
