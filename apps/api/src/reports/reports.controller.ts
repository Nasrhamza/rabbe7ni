import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { ReportsService } from "./reports.service.js";

@ApiTags("reports")
@RequireEntitlement("advanced_reporting")
@Controller({ path: "reports", version: "1" })
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions("report.read")
  list() {
    return this.reports.list();
  }

  @Post()
  @RequirePermissions("report.manage")
  create(@Body() body: unknown) {
    return this.reports.create(body as never);
  }

  @Post(":id/run")
  @RequirePermissions("report.manage")
  run(@Param("id") id: string) {
    return this.reports.run(id);
  }

  @Get("artifacts/:id")
  @RequirePermissions("report.download")
  async artifact(
    @Param("id") id: string,
    @Query("format") requestedFormat: string | undefined,
    @Res({ passthrough: true }) response: FastifyReply,
  ) {
    const format = requestedFormat?.toLowerCase() === "pdf" ? "pdf" : "csv";
    const artifact = await this.reports.downloadableArtifact(id, format);
    response.header("content-type", artifact.mimeType);
    response.header(
      "content-disposition",
      `attachment; filename="${artifact.fileName.replaceAll('"', "")}"`,
    );
    response.header("x-content-sha256", artifact.checksum);
    return new StreamableFile(artifact.content);
  }
}
