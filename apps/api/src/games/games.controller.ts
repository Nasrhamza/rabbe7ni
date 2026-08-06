import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { GamesService } from "./games.service.js";

@ApiTags("games")
@RequireEntitlement("gamification")
@Controller({ path: "games", version: "1" })
export class GamesController {
  constructor(@Inject(GamesService) private readonly games: GamesService) {}

  @Get()
  list(@Query("view") view?: string) {
    return this.games.list(view === "management");
  }

  @Post()
  @RequirePermissions("gamification.manage")
  create(@Body() body: unknown) {
    return this.games.create(body);
  }

  @Get("culture/prize-suggestions")
  @RequirePermissions("gamification.manage")
  culturalPrizeSuggestions(@Query() query: unknown) {
    return this.games.culturalPrizeSuggestions(query);
  }

  @Get(":id")
  @RequirePermissions("gamification.manage")
  get(@Param("id") id: string) {
    return this.games.get(id);
  }

  @Patch(":id")
  @RequirePermissions("gamification.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.games.update(id, body);
  }

  @Post(":id/status")
  @RequirePermissions("gamification.manage")
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.games.changeStatus(id, body);
  }

  @Put(":id/prizes")
  @RequirePermissions("gamification.manage")
  replacePrizes(@Param("id") id: string, @Body() body: unknown) {
    return this.games.replacePrizes(id, body);
  }

  @Post(":code/play")
  play(@Param("code") code: string, @Body() body: unknown) {
    return this.games.play(code, body);
  }
}
