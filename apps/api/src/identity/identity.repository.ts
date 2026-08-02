import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "@rabbehni/database/nest";

import type { CreateUserDto } from "./dto.js";

@Injectable()
export class IdentityRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  create(input: CreateUserDto) {
    const normalizedEmail = input.email.trim().toLowerCase();
    return this.prisma.user.create({
      data: {
        email: input.email.trim(),
        normalizedEmail,
        displayName: input.displayName,
        locale: input.locale ?? "en",
        ...(input.externalSubject ? { externalSubject: input.externalSubject } : {}),
      },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
