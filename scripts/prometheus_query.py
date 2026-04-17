#!/usr/bin/env python3
"""
Prometheus Trading Metrics Reporter
Queries Prometheus API and prints a formatted metrics report.

Usage:
    PROMETHEUS_URL=http://prometheus:9090 python3 prometheus_query.py
    python3 prometheus_query.py  # uses default localhost:9090
"""

import requests
import logging
import os
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-8s %(message)s")
log = logging.getLogger(__name__)

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")

QUERIES = {
    "p50_latency_ms": (
        'histogram_quantile(0.50, rate(order_execution_latency_seconds_bucket[1m])) * 1000'
    ),
    "p95_latency_ms": (
        'histogram_quantile(0.95, rate(order_execution_latency_seconds_bucket[1m])) * 1000'
    ),
    "p99_latency_ms": (
        'histogram_quantile(0.99, rate(order_execution_latency_seconds_bucket[1m])) * 1000'
    ),
    "orders_per_second": "rate(orders_total[1m])",
    "fill_rate_pct": (
        "(rate(orders_filled_total[1m]) / rate(orders_total[1m])) * 100"
    ),
    "rejection_rate_pct": (
        "(rate(orders_rejected_total[1m]) / rate(orders_total[1m])) * 100"
    ),
    "kafka_lag_total": (
        'sum(kafka_consumergroup_lag{namespace="trading"}) by (consumergroup, topic)'
    ),
    "pod_restarts": (
        'sum(kube_pod_container_status_restarts_total{namespace="trading"}) by (pod)'
    ),
}


def instant_query(expr: str) -> list[dict]:
    try:
        resp = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": expr},
            timeout=5,
        )
        resp.raise_for_status()
        return resp.json()["data"]["result"]
    except requests.RequestException as e:
        log.error("Query failed: %s", e)
        return []


def range_query(expr: str, hours: float = 1.0, step: int = 60) -> list[dict]:
    end = datetime.utcnow()
    start = end - timedelta(hours=hours)
    try:
        resp = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query_range",
            params={
                "query": expr,
                "start": start.timestamp(),
                "end": end.timestamp(),
                "step": step,
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()["data"]["result"]
    except requests.RequestException as e:
        log.error("Range query failed: %s", e)
        return []


def get_scalar(expr: str) -> float | None:
    results = instant_query(expr)
    if results:
        try:
            return float(results[0]["value"][1])
        except (KeyError, IndexError, ValueError):
            pass
    return None


def traffic_light(val: float | None, warn: float, crit: float, invert: bool = False) -> str:
    if val is None:
        return "⚪"
    bad = val > crit if not invert else val < crit
    mid = val > warn if not invert else val < warn
    if bad:
        return "🔴"
    if mid:
        return "🟡"
    return "🟢"


def print_report() -> None:
    ts = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
    print(f"\n{'='*60}")
    print(f"  TRADING METRICS REPORT  —  {ts}")
    print(f"{'='*60}")

    print("\n  EXECUTION LATENCY")
    for key, warn, crit in [
        ("p50_latency_ms", 5, 10),
        ("p95_latency_ms", 20, 40),
        ("p99_latency_ms", 30, 60),
    ]:
        v = get_scalar(QUERIES[key])
        label = key.replace("_latency_ms", "").upper()
        icon = traffic_light(v, warn, crit)
        print(f"    {icon}  {label}: {v:.2f} ms" if v is not None else f"    ⚪  {label}: N/A")

    print("\n  ORDER FLOW")
    for key, label, warn, crit, invert in [
        ("orders_per_second", "Orders/s", 500, 200, True),
        ("fill_rate_pct",     "Fill Rate", 97, 95, True),
        ("rejection_rate_pct", "Rejection %", 0.5, 1.0, False),
    ]:
        v = get_scalar(QUERIES[key])
        icon = traffic_light(v, warn, crit, invert)
        suffix = "" if "s" in label else " %"
        print(f"    {icon}  {label}: {v:.2f}{suffix}" if v is not None else f"    ⚪  {label}: N/A")

    print("\n  KAFKA LAG  (by consumer group)")
    results = instant_query(QUERIES["kafka_lag_total"])
    if results:
        for r in results:
            lag = float(r["value"][1])
            icon = "🔴" if lag > 1000 else "🟡" if lag > 100 else "🟢"
            group = r["metric"].get("consumergroup", "?")
            topic = r["metric"].get("topic", "?")
            print(f"    {icon}  {group}/{topic}: lag={lag:.0f}")
    else:
        print("    ⚪  no data")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    print_report()
