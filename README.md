# TradeSentinel

**Real-time trading infrastructure observability and automation platform** — built for capital markets systems engineers.

Live demo: [tradesentinel.vercel.app](https://tradesentinel.vercel.app)

---

## What It Does

TradeSentinel gives on-call engineers a single pane of glass for trading system health:

| Page | What you see |
|------|-------------|
| **Overview** | Order flow (ord/s), P50/P95/P99 execution latency, fill rate, active alerts — auto-refreshes every 2s |
| **Infrastructure** | Kubernetes pod status across `trading`, `streaming`, `monitoring` namespaces with CrashLoopBackOff detection |
| **Kafka Streams** | Consumer group lag per topic, partition-level breakdown, throughput history |
| **Alerts** | Prometheus-compatible alert rules with severity levels, durations, and runbook links |
| **Automation** | Python scripts: K8s health check, Kafka lag monitor, auto-remediation engine |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Charts | Recharts (area, bar, line) |
| Deployment | Vercel / Kubernetes (HPA, probes) |
| Monitoring | Prometheus rules (PrometheusRule CRD) |
| Streaming | Kafka consumer group lag monitoring |
| Automation | Python 3.12+, kubectl, kafka-consumer-groups |

---

## Quick Start

```bash
npm install
npm run dev
# open http://localhost:3000
```

---

## Python Automation Scripts

Located in `scripts/` — production-ready, not stubs.

### `k8s_health_check.py`
Polls K8s API across configured namespaces. Detects `CrashLoopBackOff`, auto-restarts pods within max-restart limits, logs escalation when manual intervention is needed.

```bash
CHECK_INTERVAL=30 MAX_RESTARTS=3 python3 scripts/k8s_health_check.py
```

### `kafka_lag_monitor.py`
Polls consumer group lag per topic. Fires `WARNING` / `CRITICAL` log events at configurable thresholds. Hook the `fire_alert()` function into PagerDuty / Alertmanager.

```bash
KAFKA_BOOTSTRAP_SERVERS=kafka:9092 \
LAG_ALERT_THRESHOLD=100 \
LAG_CRITICAL_THRESHOLD=1000 \
python3 scripts/kafka_lag_monitor.py
```

### `prometheus_query.py`
Queries Prometheus API and prints a formatted trading metrics report with traffic-light indicators (P99 latency, fill rate, rejection rate, Kafka lag).

```bash
PROMETHEUS_URL=http://prometheus:9090 python3 scripts/prometheus_query.py
```

### `auto_remediation.py`
Rule-based incident response engine. Checks CrashLoopBackOff, high memory pressure, stale Kafka consumers. Applies fixes with cooldown windows. Supports dry-run and Slack notifications.

```bash
DRY_RUN=true python3 scripts/auto_remediation.py        # preview
SLACK_WEBHOOK_URL=https://... python3 scripts/auto_remediation.py
```

---

## Kubernetes Deployment

```bash
kubectl apply -f k8s/
```

- `deployment.yaml` — 2-replica deployment with CPU/memory limits, readiness/liveness probes
- `service.yaml` — ClusterIP + Ingress on `tradesentinel.internal`
- `hpa.yaml` — HPA scaling 2→6 replicas on CPU 70% / memory 80%
- `prometheus-rules.yaml` — PrometheusRule CRD: latency, Kafka lag, CrashLoopBackOff, rejection rate

---

## Architecture

```
Browser ──► Next.js App (Vercel / K8s)
              │
              ├── /api/metrics  →  order flow, latency percentiles
              ├── /api/pods     →  K8s pod health
              ├── /api/kafka    →  consumer group lag
              └── /api/alerts   →  firing / resolved alerts

Production integration points:
  /api/metrics  →  Prometheus query API
  /api/pods     →  kubectl / K8s API server
  /api/kafka    →  kafka-consumer-groups.sh
  /api/alerts   →  Alertmanager API
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROMETHEUS_URL` | `http://prometheus:9090` | Prometheus server |
| `KAFKA_BOOTSTRAP_SERVERS` | `kafka:9092` | Kafka brokers |
| `LAG_ALERT_THRESHOLD` | `100` | Consumer lag warning threshold |
| `LAG_CRITICAL_THRESHOLD` | `1000` | Consumer lag critical threshold |
| `K8S_NAMESPACES` | `trading,streaming,monitoring` | Namespaces to monitor |
| `DRY_RUN` | `false` | Auto-remediation dry-run mode |
| `SLACK_WEBHOOK_URL` | — | Slack webhook for remediation alerts |

---

Built to directly mirror the operational challenges at capital markets firms: real-time trading system monitoring, Kubernetes reliability, Kafka stream health, and automated incident response.
