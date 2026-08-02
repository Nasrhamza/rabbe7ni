# Deployment architecture

## Environments

- Local: Docker Compose plus host-run applications.
- Test: isolated ephemeral resources.
- Staging: production-like managed services and anonymized/synthetic data.
- Production: private networking, managed secrets, backups, autoscaling and disaster recovery.

## Workload classes

| Workload               | Scaling signal                                    |
| ---------------------- | ------------------------------------------------- |
| Admin and merchant web | HTTP concurrency and latency                      |
| API                    | HTTP concurrency, CPU and latency                 |
| Notification worker    | queue depth and job age                           |
| AI inference           | inference latency and queue depth                 |
| Analytics service      | HTTP latency, ingestion lag and ClickHouse health |
| Reporting              | queue depth, CPU and memory                       |

## Deployment rules

- Immutable container images.
- Non-root runtime users.
- Read-only filesystem where supported.
- Migration job runs once before compatible application rollout.
- Readiness gates traffic.
- Rolling deployment for stateless workloads.
- Backward-compatible event and API changes during mixed-version rollout.

## Cloud decision

The repository remains cloud-neutral in Phase 1. Terraform and the exact managed container platform
will be introduced only after the cloud provider, region, budget and Kubernetes requirement are
validated.

The Expo Development Build is not containerized. Android/iOS builds use native Expo/EAS workflows;
Docker Compose covers server-side and web processes only.
