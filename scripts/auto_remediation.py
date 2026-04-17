#!/usr/bin/env python3
"""
Automated Incident Remediation Engine
Watches common trading infrastructure failure modes and applies fixes
with configurable cooldowns and Slack notifications.

Usage:
    DRY_RUN=true python3 auto_remediation.py          # safe preview
    SLACK_WEBHOOK_URL=https://... python3 auto_remediation.py
"""

import subprocess
import json
import time
import logging
import os
import urllib.request
from dataclasses import dataclass, field
from typing import Callable
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

DRY_RUN = os.getenv("DRY_RUN", "false").lower() == "true"
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK_URL", "")
LOOP_INTERVAL = int(os.getenv("LOOP_INTERVAL", "30"))


# ─── Rule engine ──────────────────────────────────────────────────────────────

@dataclass
class Rule:
    name: str
    description: str
    check: Callable[[], bool]
    fix: Callable[[], str]
    cooldown_seconds: int = 300
    _last_triggered: float = field(default=0.0, init=False)

    def on_cooldown(self) -> bool:
        return (time.time() - self._last_triggered) < self.cooldown_seconds

    def run(self) -> None:
        if self.on_cooldown():
            return
        try:
            if not self.check():
                return
            log.warning("[TRIGGER] %s", self.name)
            if DRY_RUN:
                log.info("[DRY RUN] Would apply: %s", self.description)
                result = f"[dry-run] {self.description}"
            else:
                result = self.fix()
                log.info("[REMEDIATED] %s → %s", self.name, result)
            _notify_slack(self.name, result)
            self._last_triggered = time.time()
        except Exception as e:
            log.error("[ERROR] Rule %s failed: %s", self.name, e)


# ─── Notifications ────────────────────────────────────────────────────────────

def _notify_slack(rule: str, action: str) -> None:
    if not SLACK_WEBHOOK:
        return
    ts = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    payload = json.dumps({
        "text": (
            f":robot_face: *Auto-remediation triggered*\n"
            f"*Rule:* `{rule}`\n"
            f"*Action:* {action}\n"
            f"*Time:* {ts}"
        )
    }).encode()
    try:
        req = urllib.request.Request(
            SLACK_WEBHOOK,
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        log.error("Slack notification failed: %s", e)


# ─── Check & fix implementations ─────────────────────────────────────────────

def _kubectl(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["kubectl", *args],
        capture_output=True,
        text=True,
    )


def check_crashloop() -> bool:
    r = _kubectl(["get", "pods", "-A", "-o", "json"])
    if r.returncode != 0:
        return False
    for item in json.loads(r.stdout).get("items", []):
        for cs in item["status"].get("containerStatuses", []):
            if cs.get("state", {}).get("waiting", {}).get("reason") == "CrashLoopBackOff":
                ns = item["metadata"]["namespace"]
                pod = item["metadata"]["name"]
                log.warning("CrashLoopBackOff detected: %s/%s", ns, pod)
                return True
    return False


def fix_crashloop() -> str:
    r = _kubectl([
        "get", "pods", "-A",
        "--field-selector=status.phase!=Running",
        "-o", "name",
    ])
    pods = r.stdout.strip().splitlines()
    restarted = 0
    for ref in pods:
        parts = ref.split("/", 1)
        ns, name = (parts[0], parts[1]) if len(parts) == 2 else ("default", parts[0])
        _kubectl(["delete", "pod", name, "-n", ns, "--grace-period=0"])
        restarted += 1
    return f"Deleted {restarted} pod(s) — will be recreated by their Deployment"


def check_high_memory() -> bool:
    r = _kubectl(["top", "pods", "-n", "trading", "--no-headers"])
    for line in r.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 3:
            mem = parts[2].replace("Mi", "").replace("Gi", "000")
            try:
                if int(mem) > 1800:
                    log.warning("High memory detected on pod: %s (%sMi)", parts[0], mem)
                    return True
            except ValueError:
                pass
    return False


def fix_high_memory() -> str:
    _kubectl(["rollout", "restart", "deployment/order-router", "-n", "trading"])
    return "Rolling restart triggered on order-router deployment"


def check_stale_kafka_consumer() -> bool:
    """Detect consumer groups with members that haven't committed offsets recently."""
    r = _kubectl([
        "exec", "-n", "streaming", "kafka-broker-0", "--",
        "kafka-consumer-groups.sh", "--bootstrap-server", "kafka:9092",
        "--describe", "--all-groups",
    ])
    for line in r.stdout.splitlines():
        parts = line.split()
        if len(parts) >= 5:
            try:
                lag = int(parts[4])
                if lag > 5000:
                    return True
            except (ValueError, IndexError):
                pass
    return False


def fix_stale_kafka_consumer() -> str:
    _kubectl([
        "rollout", "restart",
        "deployment/market-data-consumer", "-n", "trading",
    ])
    return "Restarted market-data-consumer to trigger partition rebalance"


# ─── Rule registry ────────────────────────────────────────────────────────────

RULES: list[Rule] = [
    Rule(
        name="CrashLoopBackOff",
        description="Delete pods stuck in CrashLoopBackOff — Deployment recreates them",
        check=check_crashloop,
        fix=fix_crashloop,
        cooldown_seconds=180,
    ),
    Rule(
        name="HighMemoryPressure",
        description="Rolling restart when any trading pod exceeds 1800Mi",
        check=check_high_memory,
        fix=fix_high_memory,
        cooldown_seconds=600,
    ),
    Rule(
        name="StaleKafkaConsumer",
        description="Restart consumer when lag exceeds 5000 messages",
        check=check_stale_kafka_consumer,
        fix=fix_stale_kafka_consumer,
        cooldown_seconds=300,
    ),
]


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    mode = "DRY RUN" if DRY_RUN else "LIVE"
    log.info(
        "Auto-remediation engine [%s] — %d rules, loop_interval=%ds",
        mode, len(RULES), LOOP_INTERVAL,
    )
    while True:
        for rule in RULES:
            rule.run()
        time.sleep(LOOP_INTERVAL)


if __name__ == "__main__":
    main()
