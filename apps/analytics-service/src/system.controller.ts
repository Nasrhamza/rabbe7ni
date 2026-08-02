import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { buildTechnicalStatus } from "@rabbehni/contracts";

@ApiTags("system")
@Controller({ path: "", version: "1" })
export class SystemController {
  @Get()
  @ApiOperation({ summary: "Describe the analytics technical shell" })
  describe() {
    return { ...buildTechnicalStatus("analytics-service"), phase: "8" };
  }
}
