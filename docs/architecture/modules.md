# Module boundaries

The backend will begin as a modular transactional core with independently deployable workers and
specialized data services. A module owns its state and invariants.

| Planned module       | Owns                                                    | Forbidden direct ownership  |
| -------------------- | ------------------------------------------------------- | --------------------------- |
| Identity integration | OIDC mapping and authentication context                 | Password storage            |
| Authorization        | Memberships, roles and resource scopes                  | Domain records              |
| Platform             | Plans, countries, regions and global configuration      | Provider payment state      |
| Tenant               | Organisation lifecycle and isolation policy             | Commerce operations         |
| Franchise            | Network membership and inherited policy versions        | Visits and rewards          |
| Merchant             | Commerce, outlet and staff assignments                  | Loyalty balances            |
| Customer             | Customer profile, preferences and consent               | Identity credentials        |
| Visit                | QR validation, check-ins and visits                     | Loyalty ledger              |
| Loyalty              | Programs, rules, score and point ledger                 | Random game outcomes        |
| Reward               | Catalogue, grants, claims and redemptions               | SaaS invoices               |
| Gamification         | Game configuration, participation and outcomes          | Notification transport      |
| Smart Habits         | Habit definition and progress                           | Generic campaigns           |
| Campaign             | Campaign lifecycle, target and eligibility              | Message delivery            |
| Automation           | Triggers, schedules and journey state                   | Provider credentials        |
| Notification         | Channel rendering, delivery and callbacks               | Audience decisions          |
| Billing              | Subscription state, entitlements, metering and invoices | Customer loyalty            |
| Branding             | Themes, domains, logos and templates                    | Identity authorization      |
| Cultural Engine      | Approved regional rules and ranking                     | Legal policy overrides      |
| Analytics            | Event projections, aggregates and KPIs                  | Operational mutations       |
| AI                   | Features, training, inference and explanations          | Direct reward grants        |
| Reporting            | PDF/CSV rendering                                       | Alternative KPI calculation |
| Audit                | Security and business audit trail                       | General debug logging       |

Phase 2 materializes the approved `identity`, `tenancy`, `organizations`, `franchises`, `merchants`,
`subscriptions` and `audit` modules. Authentication, loyalty, QR, gamification, campaigns, payment
provider integration and AI business modules remain absent.
