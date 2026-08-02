import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Job } from "bullmq";

import { AnalyticsGateway } from "../analytics/analytics.gateway.js";
import { parseDto } from "../common/validation.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { createReportSchema, reportIdSchema } from "./dto.js";
import { ReportQueue } from "./reports.queue.js";
import { ReportsRepository } from "./reports.repository.js";

@Injectable()
export class ReportsService {
  constructor(
    @Inject(ReportsRepository) private readonly reports: ReportsRepository,
    @Inject(ReportQueue) private readonly queue: ReportQueue,
    @Inject(AnalyticsGateway) private readonly analytics: AnalyticsGateway,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  list() {
    return this.reports.list();
  }

  async create(input: never) {
    const definition = await this.reports.create(parseDto(createReportSchema, input));
    if (definition.active) {
      await this.queue.schedule(
        definition.tenantId,
        definition.id,
        definition.frequency,
        definition.timezone,
      );
    }
    return definition;
  }

  async run(id: string) {
    const definition = await this.reports.getDefinition(parseDto(reportIdSchema, id));
    if (!definition) throw new NotFoundException("Report definition not found");
    const periodEnd = new Date();
    const days = definition.frequency === "DAILY" ? 1 : definition.frequency === "WEEKLY" ? 7 : 30;
    const execution = await this.reports.createExecution(
      definition.id,
      new Date(periodEnd.getTime() - days * 86_400_000),
      periodEnd,
    );
    if (execution.status === "QUEUED") {
      await this.queue.enqueue(execution.tenantId, execution.id);
    }
    return execution;
  }

  async process(executionId: string, job: Pick<Job, "attemptsMade" | "opts">) {
    const execution = await this.reports.loadExecution(executionId);
    if (!execution) throw new NotFoundException("Report execution not found");
    if (execution.status === "COMPLETED") return execution;
    await this.reports.start(execution.id);
    try {
      const filters = this.object(execution.definition.filters);
      const result = await this.analytics.metrics(execution.tenantId, {
        from: execution.periodStart,
        to: execution.periodEnd,
        timezone: execution.definition.timezone,
        ...(this.uuid(filters.organizationId)
          ? { organizationId: String(filters.organizationId) }
          : {}),
        ...(this.uuid(filters.franchiseId) ? { franchiseId: String(filters.franchiseId) } : {}),
        ...(this.uuid(filters.merchantId) ? { merchantId: String(filters.merchantId) } : {}),
        ...(this.uuid(filters.branchId) ? { branchId: String(filters.branchId) } : {}),
      });
      const requested = Array.isArray(execution.definition.metrics)
        ? execution.definition.metrics.filter((value): value is string => typeof value === "string")
        : [];
      const items = result.items.filter(
        ({ metric }) => requested.length === 0 || requested.includes(metric),
      );
      const csv = this.csv(execution, items, result.freshnessSeconds);
      const artifact = await this.reports.complete(
        execution.id,
        execution.definition,
        Buffer.from(csv, "utf8"),
        { metrics: items.length, freshnessSeconds: result.freshnessSeconds },
      );
      if (execution.definition.recipientCustomerId && execution.definition.notificationTemplateId) {
        await this.notifications.queueDelivery({
          customerId: execution.definition.recipientCustomerId,
          templateId: execution.definition.notificationTemplateId,
          variables: {
            reportName: execution.definition.name,
            periodStart: execution.periodStart.toISOString(),
            periodEnd: execution.periodEnd.toISOString(),
          },
          deepLink: { type: "report", artifactId: artifact.id },
          idempotencyKey: `report-delivery:${execution.id}`,
        } as never);
      }
      return { executionId: execution.id, artifactId: artifact.id };
    } catch (error) {
      const deadLetter = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.reports.fail(
        execution.id,
        error instanceof Error ? error.message : String(error),
        deadLetter,
      );
      throw error;
    }
  }

  async artifact(id: string) {
    const artifact = await this.reports.artifact(parseDto(reportIdSchema, id));
    if (!artifact) throw new NotFoundException("Report artifact not found or expired");
    return artifact;
  }

  async downloadableArtifact(id: string, format: "csv" | "pdf") {
    const artifact = await this.artifact(id);
    if (format === "csv") return artifact;

    const reportName = artifact.execution.definition.name;
    const csv = Buffer.from(artifact.content).toString("utf8");
    const pdf = this.pdf(reportName, csv);
    return {
      ...artifact,
      fileName: artifact.fileName.replace(/\.csv$/iu, ".pdf"),
      mimeType: "application/pdf",
      content: pdf,
      checksum: (await import("node:crypto")).createHash("sha256").update(pdf).digest("hex"),
      sizeBytes: pdf.byteLength,
    };
  }

  private csv(
    execution: { periodStart: Date; periodEnd: Date },
    items: readonly {
      metric: string;
      value: number;
      previousValue: number | null;
      changeRate: number | null;
    }[],
    freshnessSeconds: number | null,
  ): string {
    const rows = [
      ["period_start", execution.periodStart.toISOString()],
      ["period_end", execution.periodEnd.toISOString()],
      ["freshness_seconds", freshnessSeconds ?? ""],
      [],
      ["metric", "value", "previous_value", "change_rate"],
      ...items.map((item) => [
        item.metric,
        item.value,
        item.previousValue ?? "",
        item.changeRate ?? "",
      ]),
    ];
    return rows.map((row) => row.map((value) => this.csvCell(value)).join(",")).join("\r\n");
  }

  private csvCell(value: string | number): string {
    let text = String(value);
    if (/^[=+\-@]/u.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }

  private pdf(reportName: string, csv: string): Buffer {
    const clean = (value: string) =>
      value
        .normalize("NFKD")
        .replaceAll(/[\u0300-\u036f]/gu, "")
        .replaceAll(/[^\x20-\x7E]/gu, "?")
        .replaceAll(/([\\()])/gu, "\\$1");
    const lines = csv
      .split(/\r?\n/u)
      .filter(Boolean)
      .slice(0, 42)
      .map((line) => clean(line.replaceAll('"', "").replaceAll(",", "  |  ")));
    const commands = [
      "BT",
      "/F1 18 Tf",
      "50 795 Td",
      `(Rabbehni - ${clean(reportName)}) Tj`,
      "0 -28 Td",
      "/F1 9 Tf",
      ...lines.flatMap((line) => [`(${line.slice(0, 108)}) Tj`, "0 -15 Td"]),
      "ET",
    ].join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      `<< /Length ${Buffer.byteLength(commands, "ascii")} >>\nstream\n${commands}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let document = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(document, "ascii"));
      document += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(document, "ascii");
    document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    document += offsets
      .slice(1)
      .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
      .join("");
    document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(document, "ascii");
  }

  private object(value: unknown): Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Readonly<Record<string, unknown>>)
      : {};
  }

  private uuid(value: unknown): boolean {
    return typeof value === "string" && /^[0-9a-f-]{36}$/iu.test(value);
  }
}
