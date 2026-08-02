import { Inject, Injectable } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import { createUserSchema, type CreateUserDto } from "./dto.js";
import { IdentityRepository } from "./identity.repository.js";

@Injectable()
export class IdentityService {
  constructor(@Inject(IdentityRepository) private readonly users: IdentityRepository) {}

  createUser(input: CreateUserDto) {
    return this.users.create(parseDto(createUserSchema, input));
  }

  getUser(id: string) {
    return this.users.findById(id);
  }
}
