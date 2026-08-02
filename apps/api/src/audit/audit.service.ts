import { Inject, Injectable } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import { AuditRepository } from "./audit.repository.js";
import { recordAuditSchema, type RecordAuditDto } from "./dto.js";

@Injectable()
export class AuditService {
  constructor(@Inject(AuditRepository) private readonly auditLogs: AuditRepository) {}

  record(input: RecordAuditDto) {
    return this.auditLogs.record(parseDto(recordAuditSchema, input));
  }

  listRecent(limit = 50) {
    return this.auditLogs.listRecent(limit);
  }
}
