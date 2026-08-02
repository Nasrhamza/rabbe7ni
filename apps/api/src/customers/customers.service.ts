import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import { CustomersRepository } from "./customers.repository.js";
import {
  createCustomerSchema,
  customerIdSchema,
  customerListSchema,
  customerPreferencesSchema,
  customerProfileSchema,
  customerStatusSchema,
  updateCustomerSchema,
  type CreateCustomerDto,
  type CustomerListDto,
  type CustomerPreferencesDto,
  type CustomerProfileDto,
  type CustomerStatusDto,
  type UpdateCustomerDto,
} from "./dto.js";

@Injectable()
export class CustomersService {
  constructor(@Inject(CustomersRepository) private readonly customers: CustomersRepository) {}

  async create(input: CreateCustomerDto) {
    return this.require(await this.customers.create(parseDto(createCustomerSchema, input)));
  }
  list(input: CustomerListDto = {}) {
    return this.customers.list(parseDto(customerListSchema, input));
  }
  async get(id: string) {
    return this.require(await this.customers.findById(parseDto(customerIdSchema, id)));
  }
  async me() {
    return this.require(await this.customers.findMe());
  }
  async update(id: string, input: UpdateCustomerDto) {
    return this.require(
      await this.customers.update(
        parseDto(customerIdSchema, id),
        parseDto(updateCustomerSchema, input),
      ),
    );
  }
  async updateMyPreferences(input: CustomerPreferencesDto) {
    const customer = await this.me();
    return this.require(
      await this.customers.update(customer.id, parseDto(customerPreferencesSchema, input), true),
    );
  }
  async updateMyProfile(input: CustomerProfileDto) {
    return this.require(
      await this.customers.updateMyProfile(parseDto(customerProfileSchema, input)),
    );
  }
  async myReferral() {
    return this.require(await this.customers.myReferral());
  }
  async myReferralHistory() {
    return this.require(await this.customers.myReferralHistory());
  }
  async changeStatus(id: string, input: CustomerStatusDto) {
    const dto = parseDto(customerStatusSchema, input);
    return this.require(
      await this.customers.changeStatus(parseDto(customerIdSchema, id), dto.status),
    );
  }
  async archive(id: string) {
    return this.require(await this.customers.archive(parseDto(customerIdSchema, id)));
  }
  private require<T>(value: T | null): T {
    if (!value) throw new NotFoundException("Customer not found or outside the authorized scope");
    return value;
  }
}
