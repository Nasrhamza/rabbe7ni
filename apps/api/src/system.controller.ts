import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { buildTechnicalStatus, type TechnicalStatus } from "@rabbehni/contracts";

import { Public } from "./common/security.js";

@ApiTags("system")
@Public()
@Controller({
  path: "",
  version: "1",
})
export class SystemController {
  @Get()
  @ApiOperation({ summary: "Describe the API foundation" })
  describe(): TechnicalStatus {
    return buildTechnicalStatus("api");
  }
}
