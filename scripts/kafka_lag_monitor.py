#!/usr/bin/env python3
"""
Kafka Consumer Group Lag Monitor
Polls consumer group lag per topic/partition and fires alerts above thresholds.

Usage:
    KAFKA_BOOTSTRAP_SERVERS=kafka:9092 \\
    LAG_ALERT_THRESHOLD=100 \\
    LAG_CRITICAL_THRESHOLD=1000 \\
    python3 kafka_lag_monitor.py
"""

import subprocess
import time
import logging
import os
from dataclasses import dataclass, field

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
WARN_THRESHOLD = int(os.getenv("LAG_ALERT_THRESHOLD", "100"))
CRIT_THRESHOLD = int(os.getenv("LAG_CRITICAL_THRESHOLD", "1000"))
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "15"))

CONSUMER_GROUPS = [
    "order-processor",
    "market-data-consumer",
    "trade-recorder",
    "risk-evaluator",
    "position-manager",
]


@dataclass
class PartitionLag:
    group: str
    topic: str
    partition: int
    current_offset: int
    log_end_offset: int
    lag: int = field(init=False)

    def __post_init__(self) -> None:
        self.lag = max(0, self.log_end_offset - self.current_offset)


def get_consumer_lag(group: str) -> list[PartitionLag]:
    result = subprocess.run(
        [
            "kafka-consumer-groups.sh",
            "--bootstrap-server", BOOTSTRAP,
            "--group", group,
            "--describe",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        log.error("Failed to get lag for %s: %s", group, result.stderr.strip())
        return []

    lags = []
    for line in result.stdout.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 4:
            try:
                lags.append(
                    PartitionLag(
                        group=group,
                        topic=parts[0],
                        partition=int(parts[1]),
                        current_offset=int(parts[2]),
                        log_end_offset=int(parts[3]),
                    )
                )
            except (ValueError, IndexError):
                continue
    return lags


def fire_alert(level: str, group: str, topic: str, total_lag: int) -> None:
    log.warning(
        "[%s] group=%s topic=%s total_lag=%d", level, group, topic, total_lag
    )
    # Production hook: push to PagerDuty / Alertmanager / Slack webhook


def check_lag() -> None:
    log.debug("Checking consumer group lag...")
    for group in CONSUMER_GROUPS:
        by_topic: dict[str, int] = {}
        for pl in get_consumer_lag(group):
            by_topic[pl.topic] = by_topic.get(pl.topic, 0) + pl.lag

        for topic, total in by_topic.items():
            if total >= CRIT_THRESHOLD:
                fire_alert("CRITICAL", group, topic, total)
            elif total >= WARN_THRESHOLD:
                fire_alert("WARNING", group, topic, total)
            else:
                log.info("OK  group=%-30s topic=%-25s lag=%d", group, topic, total)


def main() -> None:
    log.info(
        "Kafka lag monitor started (bootstrap=%s warn=%d crit=%d interval=%ds)",
        BOOTSTRAP,
        WARN_THRESHOLD,
        CRIT_THRESHOLD,
        CHECK_INTERVAL,
    )
    while True:
        try:
            check_lag()
        except Exception as e:
            log.error("Lag check error: %s", e)
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
