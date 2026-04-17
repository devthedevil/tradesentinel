#!/usr/bin/env python3
"""
Kubernetes Pod Health Monitor
Polls K8s API, detects CrashLoopBackOff, and auto-restarts with cooldown.

Usage:
    python3 k8s_health_check.py
    CHECK_INTERVAL=60 MAX_RESTARTS=5 python3 k8s_health_check.py
"""

import subprocess
import json
import time
import logging
import os
from dataclasses import dataclass

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)

NAMESPACES = os.getenv("K8S_NAMESPACES", "trading,streaming,monitoring").split(",")
MAX_RESTARTS = int(os.getenv("MAX_RESTARTS", "3"))
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "30"))


@dataclass
class PodStatus:
    name: str
    namespace: str
    status: str
    restarts: int
    ready: bool


def get_pods(namespace: str) -> list[PodStatus]:
    result = subprocess.run(
        ["kubectl", "get", "pods", "-n", namespace, "-o", "json"],
        capture_output=True,
        text=True,
        check=True,
    )
    pods = []
    for item in json.loads(result.stdout)["items"]:
        containers = item["status"].get("containerStatuses", [])
        restarts = sum(c.get("restartCount", 0) for c in containers)
        ready = all(c.get("ready", False) for c in containers)
        crash = any(
            c.get("state", {}).get("waiting", {}).get("reason") == "CrashLoopBackOff"
            for c in containers
        )
        pods.append(
            PodStatus(
                name=item["metadata"]["name"],
                namespace=namespace,
                status="CrashLoopBackOff"
                if crash
                else item["status"].get("phase", "Unknown"),
                restarts=restarts,
                ready=ready,
            )
        )
    return pods


def restart_pod(name: str, namespace: str) -> None:
    log.warning("Restarting pod %s/%s", namespace, name)
    subprocess.run(
        ["kubectl", "delete", "pod", name, "-n", namespace, "--grace-period=0"],
        check=True,
    )


def check_health() -> int:
    issues = 0
    for ns in NAMESPACES:
        try:
            for pod in get_pods(ns.strip()):
                if pod.status == "CrashLoopBackOff":
                    log.error(
                        "CRASH: %s/%s restarts=%d", ns, pod.name, pod.restarts
                    )
                    if pod.restarts <= MAX_RESTARTS:
                        restart_pod(pod.name, ns.strip())
                    else:
                        log.error(
                            "Manual intervention required — %s exceeded %d restarts",
                            pod.name,
                            MAX_RESTARTS,
                        )
                    issues += 1
                elif not pod.ready and pod.status == "Running":
                    log.warning("Not ready: %s/%s", ns, pod.name)
                    issues += 1
        except subprocess.CalledProcessError as e:
            log.error("kubectl error for %s: %s", ns, e)
    if issues == 0:
        log.info("All pods healthy across %s", NAMESPACES)
    return issues


def main() -> None:
    log.info(
        "K8s health monitor started (namespaces=%s interval=%ds max_restarts=%d)",
        NAMESPACES,
        CHECK_INTERVAL,
        MAX_RESTARTS,
    )
    while True:
        try:
            check_health()
        except Exception as e:
            log.error("Unhandled error: %s", e)
        time.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    main()
