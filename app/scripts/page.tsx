"use client";

import { useState } from "react";
import { Code2, Copy, Check } from "lucide-react";
import clsx from "clsx";

const SCRIPTS = [
  {
    name: "k8s_health_check.py",
    description: "Polls K8s API for pod health across trading namespaces. Auto-restarts pods in CrashLoopBackOff with configurable cooldown.",
    lang: "Python",
    code: `#!/usr/bin/env python3
"""
Kubernetes Pod Health Monitor — trading namespaces
"""
import subprocess, json, time, logging
from dataclasses import dataclass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
)
log = logging.getLogger(__name__)

NAMESPACES    = ["trading", "streaming", "monitoring"]
MAX_RESTARTS  = 3
CHECK_INTERVAL = 30  # seconds


@dataclass
class PodStatus:
    name: str
    namespace: str
    status: str
    restarts: int
    ready: bool


def get_pods(namespace: str) -> list[PodStatus]:
    out = subprocess.run(
        ["kubectl", "get", "pods", "-n", namespace, "-o", "json"],
        capture_output=True, text=True, check=True,
    ).stdout
    pods = []
    for item in json.loads(out)["items"]:
        containers = item["status"].get("containerStatuses", [])
        restarts = sum(c.get("restartCount", 0) for c in containers)
        ready    = all(c.get("ready", False) for c in containers)
        crash    = any(
            c.get("state", {}).get("waiting", {}).get("reason") == "CrashLoopBackOff"
            for c in containers
        )
        pods.append(PodStatus(
            name=item["metadata"]["name"],
            namespace=namespace,
            status="CrashLoopBackOff" if crash else item["status"].get("phase", "Unknown"),
            restarts=restarts,
            ready=ready,
        ))
    return pods


def restart_pod(name: str, namespace: str) -> None:
    log.warning("Restarting %s/%s", namespace, name)
    subprocess.run(
        ["kubectl", "delete", "pod", name, "-n", namespace, "--grace-period=0"],
        check=True,
    )


def check_health() -> None:
    for ns in NAMESPACES:
        for pod in get_pods(ns):
            if pod.status == "CrashLoopBackOff":
                log.error("CRASH: %s/%s (restarts=%d)", ns, pod.name, pod.restarts)
                if pod.restarts <= MAX_RESTARTS:
                    restart_pod(pod.name, ns)
                else:
                    log.error("Manual intervention required for %s", pod.name)


if __name__ == "__main__":
    log.info("K8s health monitor started (interval=%ds)", CHECK_INTERVAL)
    while True:
        try:
            check_health()
        except Exception as e:
            log.error("Check failed: %s", e)
        time.sleep(CHECK_INTERVAL)`,
  },
  {
    name: "kafka_lag_monitor.py",
    description: "Monitors Kafka consumer group lag per topic and partition. Fires WARNING / CRITICAL alerts with configurable thresholds.",
    lang: "Python",
    code: `#!/usr/bin/env python3
"""
Kafka Consumer Group Lag Monitor
"""
import subprocess, time, logging, os
from dataclasses import dataclass, field

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-8s %(message)s")
log = logging.getLogger(__name__)

BOOTSTRAP         = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
WARN_THRESHOLD    = int(os.getenv("LAG_ALERT_THRESHOLD", "100"))
CRIT_THRESHOLD    = int(os.getenv("LAG_CRITICAL_THRESHOLD", "1000"))
CHECK_INTERVAL    = 15

GROUPS = [
    "order-processor", "market-data-consumer",
    "trade-recorder",  "risk-evaluator", "position-manager",
]


@dataclass
class GroupLag:
    group: str; topic: str; partition: int
    current_offset: int; log_end_offset: int
    lag: int = field(init=False)
    def __post_init__(self):
        self.lag = max(0, self.log_end_offset - self.current_offset)


def get_lag(group: str) -> list[GroupLag]:
    r = subprocess.run(
        ["kafka-consumer-groups.sh", "--bootstrap-server", BOOTSTRAP,
         "--group", group, "--describe"],
        capture_output=True, text=True,
    )
    lags = []
    for line in r.stdout.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 4:
            try:
                lags.append(GroupLag(group=group, topic=parts[0],
                    partition=int(parts[1]), current_offset=int(parts[2]),
                    log_end_offset=int(parts[3])))
            except ValueError:
                pass
    return lags


def fire_alert(level: str, group: str, topic: str, lag: int) -> None:
    log.warning("[%s] group=%s topic=%s lag=%d", level, group, topic, lag)
    # hook: push to PagerDuty / Alertmanager / Slack


if __name__ == "__main__":
    log.info("Kafka lag monitor (bootstrap=%s warn=%d crit=%d)",
             BOOTSTRAP, WARN_THRESHOLD, CRIT_THRESHOLD)
    while True:
        for group in GROUPS:
            by_topic: dict[str, int] = {}
            for lg in get_lag(group):
                by_topic[lg.topic] = by_topic.get(lg.topic, 0) + lg.lag
            for topic, total in by_topic.items():
                if total >= CRIT_THRESHOLD:
                    fire_alert("CRITICAL", group, topic, total)
                elif total >= WARN_THRESHOLD:
                    fire_alert("WARNING", group, topic, total)
        time.sleep(CHECK_INTERVAL)`,
  },
  {
    name: "auto_remediation.py",
    description: "Automated incident response engine. Watches for CrashLoopBackOff and high memory pressure, applies fixes with configurable cooldowns. Supports dry-run mode and Slack notifications.",
    lang: "Python",
    code: `#!/usr/bin/env python3
"""
Automated Incident Remediation Engine
Dry-run mode: DRY_RUN=true python3 auto_remediation.py
"""
import subprocess, json, time, logging, os, urllib.request
from dataclasses import dataclass, field
from typing import Callable
from datetime import datetime

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)-8s %(message)s")
log = logging.getLogger(__name__)

DRY_RUN       = os.getenv("DRY_RUN", "false").lower() == "true"
SLACK_WEBHOOK = os.getenv("SLACK_WEBHOOK_URL", "")


@dataclass
class Rule:
    name: str
    check: Callable[[], bool]
    fix: Callable[[], str]
    cooldown: int = 300
    _last: float = field(default=0.0, init=False)

    def run(self) -> None:
        if time.time() - self._last < self.cooldown:
            return
        try:
            if self.check():
                log.warning("[TRIGGERED] %s", self.name)
                result = "[DRY RUN]" if DRY_RUN else self.fix()
                log.info("[DONE] %s → %s", self.name, result)
                notify(self.name, result)
                self._last = time.time()
        except Exception as e:
            log.error("[ERROR] %s: %s", self.name, e)


def notify(rule: str, action: str) -> None:
    if not SLACK_WEBHOOK:
        return
    body = json.dumps({"text": f":robot_face: *{rule}* auto-remediated\\n_{action}_"})
    req = urllib.request.Request(
        SLACK_WEBHOOK, data=body.encode(),
        headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=5)


def check_crashloop() -> bool:
    out = subprocess.run(["kubectl", "get", "pods", "-A", "-o", "json"],
                         capture_output=True, text=True).stdout
    for item in json.loads(out).get("items", []):
        for cs in item["status"].get("containerStatuses", []):
            if cs.get("state", {}).get("waiting", {}).get("reason") == "CrashLoopBackOff":
                return True
    return False


def fix_crashloop() -> str:
    r = subprocess.run(
        ["kubectl", "get", "pods", "-A",
         "--field-selector=status.phase!=Running", "-o", "name"],
        capture_output=True, text=True)
    for ref in r.stdout.strip().splitlines():
        parts = ref.split("/", 1)
        ns, name = (parts[0], parts[1]) if len(parts) == 2 else ("default", parts[0])
        subprocess.run(["kubectl", "delete", "pod", name, "-n", ns, "--grace-period=0"])
    return f"Restarted {len(r.stdout.strip().splitlines())} pod(s)"


RULES = [
    Rule(name="CrashLoopBackOff",  check=check_crashloop, fix=fix_crashloop, cooldown=180),
]

if __name__ == "__main__":
    log.info("Remediation engine [%s] — %d rules",
             "DRY RUN" if DRY_RUN else "LIVE", len(RULES))
    while True:
        for rule in RULES:
            rule.run()
        time.sleep(30)`,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded bg-[#30363d] hover:bg-[#484f58] transition-colors"
    >
      {copied ? (
        <Check className="w-3 h-3 text-[#3fb950]" />
      ) : (
        <Copy className="w-3 h-3 text-[#8b949e]" />
      )}
    </button>
  );
}

export default function ScriptsPage() {
  const [active, setActive] = useState(0);
  const script = SCRIPTS[active];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-[#e6edf3]">
          Automation Scripts
        </h1>
        <p className="text-xs text-[#8b949e] mt-0.5">
          Production-grade Python automation for trading infrastructure
        </p>
      </div>

      {/* Script selector */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {SCRIPTS.map((s, i) => (
          <button
            key={s.name}
            onClick={() => setActive(i)}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded text-xs font-medium border transition-colors",
              active === i
                ? "bg-[#58a6ff]/10 text-[#58a6ff] border-[#58a6ff]/30"
                : "bg-[#161b22] text-[#8b949e] border-[#30363d] hover:border-[#484f58]"
            )}
          >
            <Code2 className="w-3 h-3" />
            {s.name}
          </button>
        ))}
      </div>

      {/* Script detail */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363d]">
          <div>
            <span className="text-sm font-medium text-[#e6edf3] font-mono">
              {script.name}
            </span>
            <span className="ml-3 text-[10px] bg-[#bc8cff]/10 text-[#bc8cff] border border-[#bc8cff]/30 rounded px-1.5 py-0.5">
              {script.lang}
            </span>
          </div>
          <CopyButton text={script.code} />
        </div>
        <div className="px-4 py-3 border-b border-[#21262d]">
          <p className="text-xs text-[#8b949e]">{script.description}</p>
        </div>
        <div className="overflow-x-auto">
          <pre className="text-xs text-[#e6edf3] font-mono p-4 leading-relaxed bg-[#0d1117] min-h-[400px]">
            {script.code}
          </pre>
        </div>
      </div>
    </div>
  );
}
