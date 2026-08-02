# Phase 8 metric catalog

All metrics are computed from canonical events whose `source_record_id` references a real
PostgreSQL record, outbox event, or a reproducible tenant-RLS snapshot query with an explicit
range and query version. Dashboard requests query ClickHouse cleaned events and daily
facts; they never synthesize values. Periods are interpreted in the requested IANA timezone and
stored in UTC. `tenant_id` is mandatory; organization, franchise, merchant, branch and customer
dimensions are nullable and preserved from source lineage.

## Canonical event contract

Every event contains `event_id`, `event_type`, `event_version`, `occurred_at`, `processed_at`,
`source`, `source_record_id`, `correlation_id`, `idempotency_key`, all scope dimensions, numeric
`value`, validated metadata and a SHA-256 lineage digest. `(tenant_id, idempotency_key)` is unique
logically and replay uses ClickHouse `ReplacingMergeTree` semantics.

## Customer metrics

| Metric                        | Definition and formula                                                                                     | Source events/tables                       | Dimensions                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `customers.total`             | Distinct customers known by period end                                                                     | `customer.created`; `customers`            | organization                   |
| `customers.active`            | Distinct customers with at least one qualifying visit, QR, loyalty, reward or gamification event in period | cleaned activity events                    | all scopes                     |
| `customers.new`               | Distinct customers created in period                                                                       | `customer.created`; `customers.created_at` | organization                   |
| `customers.retained`          | Customers active in both current and immediately previous equal period                                     | cleaned customer activity                  | all scopes                     |
| `customers.returning`         | Active customers whose first known activity predates current period                                        | cleaned activity events                    | all scopes                     |
| `customers.inactive`          | Known customers with no qualifying activity during configured inactivity window                            | customers plus last cleaned activity       | organization                   |
| `customers.churn_indicator`   | Inactive customers / customers with prior activity; indicator, not a predicted churn fact                  | cleaned activity                           | all scopes                     |
| `customers.visit_frequency`   | Qualifying visits / distinct visiting customers                                                            | visit and successful QR events             | all scopes                     |
| `customers.lifetime_activity` | Qualifying events since customer creation                                                                  | cleaned events                             | customer, all scopes           |
| `customers.consent_rate`      | opted-in customers / customers with a communication preference record                                      | communication preference events/table      | organization, channel/category |
| `customers.opt_out_rate`      | opted-out customers / customers with a communication preference record                                     | communication preference events/table      | organization, channel/category |

## Loyalty and reward metrics

| Metric                          | Formula                                                                               | Source                         | Dimensions                       |
| ------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------- |
| `loyalty.points_earned`         | Sum positive EARN ledger points                                                       | `points_ledger_entries`        | all scopes, customer             |
| `loyalty.points_redeemed`       | Absolute sum REDEEM points                                                            | points ledger                  | all scopes, customer             |
| `loyalty.points_expired`        | Absolute sum EXPIRE points                                                            | points ledger                  | organization, customer           |
| `loyalty.points_adjusted`       | Signed sum ADJUST points                                                              | points ledger                  | all scopes                       |
| `loyalty.points_reversed`       | Signed sum REVERSE points                                                             | points ledger                  | all scopes                       |
| `loyalty.outstanding_liability` | Sum immutable ledger points through period end, never below zero per customer/program | points ledger                  | organization, merchant, customer |
| `loyalty.redemption_rate`       | redeemed points / earned points, null when denominator is zero                        | points ledger                  | all scopes                       |
| `rewards.redemptions`           | Count confirmed redemption records                                                    | reward redemptions             | all scopes, reward               |
| `rewards.popularity`            | reward redemptions / all reward redemptions                                           | reward redemptions             | reward, all scopes               |
| `rewards.stock_consumption`     | Sum redeemed quantity                                                                 | reward redemptions             | reward, merchant, branch         |
| `loyalty.engagement_rate`       | distinct customers with loyalty activity / active customers                           | points and redemption activity | all scopes                       |

## QR metrics

`qr.scans`, `qr.successful`, `qr.rejected`, `qr.expired`, `qr.replay_attempts`,
`qr.earn_usage` and `qr.redemption_usage` are counts of immutable `qr_transactions`, classified by
status, failure reason and purpose. They support organization, merchant, branch and customer
dimensions. Success rate is `successful / scans`, null when scans are zero.

## Gamification metrics

`gamification.active_participants` is distinct customers with XP, challenge, habit, badge or
leaderboard activity. `gamification.xp_earned` is positive XP ledger sum.
`gamification.level_distribution` counts current profiles by level.
Challenge enrollment/completion, habit completion, badge earned and leaderboard participation are
counts or distinct-customer counts from their immutable Phase 6 tables/events. Streak distribution
groups current streak length into `0`, `1-2`, `3-6`, `7-29`, `30+`. All support organization and
customer; events carrying merchant/branch retain those dimensions.

## Campaign and automation metrics

Campaign `targeted`, `queued`, `sent`, `delivered`, `failed`, `opened`, `clicked`, `converted` and
`unsubscribed` equal the sum of immutable `campaign_metrics.value`.
`campaign.conversion_rate = converted / delivered`, null when delivered is zero.
`automation.execution_rate = completed / started` and
`automation.failure_rate = (failed + dead_letter) / started`, both null on zero starts.
Campaign and automation identifiers are retained in metadata for drill-down.

## Merchant and branch comparisons

Activity, customer growth, loyalty engagement, campaign performance and operational comparisons
reuse the metrics above grouped by organization/franchise/merchant/branch. Period-over-period
change is `(current - previous) / abs(previous)`; it is null when the previous value is zero.
No zero-denominator rate is reported as a fabricated zero.

## Quality and freshness

`pipeline.accepted`, `pipeline.rejected`, `pipeline.duplicates`, `pipeline.dead_letters` and
`pipeline.freshness_seconds` come from ingestion receipts and maximum processed time. A dashboard
is stale when freshness exceeds its configured threshold. Quality checks reconcile canonical
event counts and metric sums to source rows for the same tenant and range, report missing
dimensions and reject cross-tenant lineage.
