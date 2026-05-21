#!/usr/bin/env python3
"""
PolyMarket Network Diagnostic Suite
Measures: DNS, ping, API latency, WebSocket lag, packet loss, system health.
Outputs: JSON report + human-readable summary.
Usage:  python polymarket_network_diagnostic.py [--duration 300] [--output report.json]
"""

import asyncio
import json
import os
import platform
import socket
import ssl
import statistics
import struct
import subprocess
import sys
import time
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Optional

import urllib.request

# ── Configuration ────────────────────────────────────────────────────────────

TARGETS = {
    "clob_api":       "https://clob.polymarket.com",
    "gamma_api":      "https://gamma-api.polymarket.com",
    "clob_ws":        "wss://ws-subscriptions-clob.polymarket.com/ws/",
    "cdn":            "https://polymarket.com",
}

# DNS endpoints to resolve
HOSTS_TO_RESOLVE = [
    "clob.polymarket.com",
    "gamma-api.polymarket.com",
    "ws-subscriptions-clob.polymarket.com",
    "polymarket.com",
]

# Cloudflare IPs for ping comparison
CLOUDFLARE_DNS = "1.1.1.1"
GOOGLE_DNS = "8.8.8.8"

# ── Data Structures ──────────────────────────────────────────────────────────

@dataclass
class DnsResult:
    host: str
    ips: list[str]
    resolution_ms: float
    error: Optional[str] = None

@dataclass
class PingResult:
    target: str
    packets_sent: int
    packets_received: int
    loss_pct: float
    rtt_min_ms: float
    rtt_avg_ms: float
    rtt_max_ms: float
    rtt_stddev_ms: float
    jitter_ms: float

@dataclass
class TracerouteHop:
    hop: int
    ip: str
    rtt1_ms: Optional[float] = None
    rtt2_ms: Optional[float] = None
    rtt3_ms: Optional[float] = None

@dataclass
class TracerouteResult:
    target: str
    hops: list[TracerouteHop] = field(default_factory=list)
    total_hops: int = 0
    error: Optional[str] = None

@dataclass
class ApiTiming:
    endpoint: str
    method: str
    status_code: int
    total_ms: float
    dns_ms: float
    connect_ms: float
    tls_ms: float
    first_byte_ms: float
    body_size: int
    error: Optional[str] = None

@dataclass
class WsLatencySample:
    direction: str  # "sent" or "echo"
    timestamp_utc: str
    latency_ms: float

@dataclass
class WsDiagnostic:
    connect_ms: float
    first_msg_ms: float
    ping_samples: list[WsLatencySample] = field(default_factory=list)
    avg_rtt_ms: float = 0.0
    min_rtt_ms: float = 0.0
    max_rtt_ms: float = 0.0
    p99_rtt_ms: float = 0.0
    disconnects: int = 0
    error: Optional[str] = None

@dataclass
class SystemMetrics:
    cpu_percent: float
    memory_percent: float
    platform: str

@dataclass
class DiagnosticReport:
    timestamp_utc: str
    local_ip: str
    isp_info: dict[str, str]
    dns_results: list[DnsResult]
    ping_results: list[PingResult]
    traceroute_results: list[TracerouteResult]
    api_timings: list[ApiTiming]
    ws_diagnostics: list[WsDiagnostic]
    system_metrics: SystemMetrics
    summary: dict = field(default_factory=dict)


# ── Utilities ────────────────────────────────────────────────────────────────

def ts_utc() -> str:
    return datetime.now(timezone.utc).isoformat()

def percentile(data: list[float], pct: float) -> float:
    if not data:
        return 0
    s = sorted(data)
    idx = int(len(s) * pct / 100)
    return s[min(idx, len(s) - 1)]


# ── DNS Diagnostics ──────────────────────────────────────────────────────────

def run_dns_diagnostics() -> list[DnsResult]:
    results = []
    for host in HOSTS_TO_RESOLVE:
        t0 = time.monotonic()
        ips = []
        error = None
        try:
            addrinfo = socket.getaddrinfo(host, 443, socket.AF_UNSPEC, socket.SOCK_STREAM)
            ips = list(set(ai[4][0] for ai in addrinfo))
        except Exception as e:
            error = str(e)
        elapsed = (time.monotonic() - t0) * 1000
        results.append(DnsResult(host=host, ips=ips, resolution_ms=round(elapsed, 2), error=error))
    return results


# ── Ping / Traceroute ────────────────────────────────────────────────────────

async def run_ping(target: str, count: int = 30, interval: float = 0.2) -> PingResult:
    """Cross-platform ping using subprocess (no root needed)."""
    system = platform.system().lower()
    if system == "windows":
        cmd = ["ping", "-n", str(count), "-w", "2000", target]
    else:
        cmd = ["ping", "-c", str(count), "-i", str(interval), "-W", "2", target]

    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    output = stdout.decode("utf-8", errors="replace")

    rtts = []
    sent = count
    received = 0

    for line in output.split("\n"):
        # Windows: "time=XXms" or "time<1ms"
        # Linux: "time=XX.X ms"
        if "time=" in line.lower():
            received += 1
            try:
                t_part = line.split("time=")[1].split("ms")[0].replace("<", "").strip()
                rtts.append(float(t_part))
            except (ValueError, IndexError):
                pass
        elif "time<" in line.lower():
            received += 1
            rtts.append(0.5)

    loss = ((sent - received) / sent * 100) if sent > 0 else 100

    jitter = 0.0
    if len(rtts) >= 2:
        jitter = statistics.mean(abs(rtts[i] - rtts[i - 1]) for i in range(1, len(rtts)))

    return PingResult(
        target=target,
        packets_sent=sent,
        packets_received=received,
        loss_pct=round(loss, 2),
        rtt_min_ms=round(min(rtts), 2) if rtts else 0,
        rtt_avg_ms=round(statistics.mean(rtts), 2) if rtts else 0,
        rtt_max_ms=round(max(rtts), 2) if rtts else 0,
        rtt_stddev_ms=round(statistics.stdev(rtts), 2) if len(rtts) >= 2 else 0,
        jitter_ms=round(jitter, 2),
    )


async def run_traceroute(target: str) -> TracerouteResult:
    """Cross-platform traceroute. Windows: tracert, Unix: traceroute -n -I."""
    system = platform.system().lower()
    if system == "windows":
        cmd = ["tracert", "-d", "-w", "2000", "-h", "20", target]
    else:
        cmd = ["traceroute", "-n", "-I", "-w", "2", "-m", "20", target]

    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    output = stdout.decode("utf-8", errors="replace")

    hops = []
    for line in output.split("\n"):
        line = line.strip()
        if not line or "traceroute" in line.lower() or "tracing" in line.lower():
            continue
        # Windows: " 1   <1 ms   <1 ms   <1 ms  192.168.1.1"
        # Linux:   " 1  192.168.1.1  1.234 ms  1.456 ms  1.678 ms"
        try:
            parts = line.split()
            hop_num = int(parts[0])
            # Grab the last token that looks like an IP
            ip = ""
            rtts = []
            for p in parts[1:]:
                p_clean = p.replace("ms", "").replace("<", "")
                try:
                    val = float(p_clean)
                    rtts.append(val)
                except ValueError:
                    if "." in p or ":" in p:
                        ip = p.strip("[]")
            if hop_num:
                hops.append(TracerouteHop(
                    hop=hop_num,
                    ip=ip,
                    rtt1_ms=round(rtts[0], 2) if len(rtts) > 0 else None,
                    rtt2_ms=round(rtts[1], 2) if len(rtts) > 1 else None,
                    rtt3_ms=round(rtts[2], 2) if len(rtts) > 2 else None,
                ))
        except (ValueError, IndexError):
            continue

    return TracerouteResult(target=target, hops=hops, total_hops=len(hops))


# ── API Latency (socket-level timing) ────────────────────────────────────────

def time_request(url: str, method: str = "GET") -> ApiTiming:
    """Measure DNS, connect, TLS, TTFB for an HTTPS request."""
    from urllib.parse import urlparse
    import http.client

    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or 443
    path = parsed.path or "/"

    dns_ms = connect_ms = tls_ms = first_byte_ms = total_ms = 0.0
    status_code = 0
    body_size = 0
    error = None

    t_total_start = time.monotonic()

    try:
        # DNS timing
        t_dns = time.monotonic()
        addrs = socket.getaddrinfo(host, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
        dns_ms = (time.monotonic() - t_dns) * 1000
        family, socktype, proto, _, sockaddr = addrs[0]

        # Connect timing
        t_connect = time.monotonic()
        sock = socket.socket(family, socktype, proto)
        sock.settimeout(10)
        sock.connect(sockaddr)
        connect_ms = (time.monotonic() - t_connect) * 1000

        # TLS timing
        t_tls = time.monotonic()
        ctx = ssl.create_default_context()
        wrapped = ctx.wrap_socket(sock, server_hostname=host)
        tls_ms = (time.monotonic() - t_tls) * 1000

        # HTTP request / TTFB
        t_req = time.monotonic()
        raw_request = f"{method} {path} HTTP/1.1\r\nHost: {host}\r\nAccept: application/json\r\nConnection: close\r\n\r\n"
        wrapped.sendall(raw_request.encode())

        response = b""
        while True:
            chunk = wrapped.recv(4096)
            if not chunk:
                break
            response += chunk
            if first_byte_ms == 0:
                first_byte_ms = (time.monotonic() - t_req) * 1000

        wrapped.close()
        total_ms = (time.monotonic() - t_total_start) * 1000
        body_size = len(response)

        # Parse status code
        resp_str = response.decode("utf-8", errors="replace")
        status_line = resp_str.split("\r\n")[0] if resp_str else ""
        try:
            status_code = int(status_line.split(" ")[1])
        except (IndexError, ValueError):
            status_code = 0

    except Exception as e:
        error = str(e)
        total_ms = (time.monotonic() - t_total_start) * 1000

    return ApiTiming(
        endpoint=url,
        method=method,
        status_code=status_code,
        total_ms=round(total_ms, 2),
        dns_ms=round(dns_ms, 2),
        connect_ms=round(connect_ms, 2),
        tls_ms=round(tls_ms, 2),
        first_byte_ms=round(first_byte_ms, 2),
        body_size=body_size,
        error=error,
    )


async def run_api_diagnostics() -> list[ApiTiming]:
    """Run API latency tests concurrently (urllib fallback for simplicity)."""
    import concurrent.futures

    endpoints = [
        (f"{TARGETS['clob_api']}/", "GET"),
        (f"{TARGETS['gamma_api']}/markets?limit=1", "GET"),
        (f"{TARGETS['cdn']}/", "GET"),
    ]

    loop = asyncio.get_running_loop()
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures = [loop.run_in_executor(pool, time_request, url, method) for url, method in endpoints]
        results = await asyncio.gather(*futures, return_exceptions=True)

    out = []
    for r in results:
        if isinstance(r, Exception):
            out.append(ApiTiming(endpoint="?", method="GET", status_code=0,
                                 total_ms=0, dns_ms=0, connect_ms=0, tls_ms=0,
                                 first_byte_ms=0, body_size=0, error=str(r)))
        else:
            out.append(r)
    return out


# ── WebSocket Latency ────────────────────────────────────────────────────────

WS_PING_INTERVAL = 2.0  # seconds between pings
WS_PING_COUNT = 20      # number of ping-pong samples


async def run_ws_diagnostics(duration_pings: int = WS_PING_COUNT) -> WsDiagnostic:
    """Connect to PolyMarket CLOB WebSocket, send pings, measure each RTT."""
    try:
        import websockets
    except ImportError:
        return WsDiagnostic(connect_ms=0, first_msg_ms=0,
                            error="websockets package not installed. Run: pip install websockets")

    ws_url = TARGETS["clob_ws"]
    result = WsDiagnostic(connect_ms=0, first_msg_ms=0)

    t_conn_start = time.monotonic()
    try:
        async with websockets.connect(
            ws_url,
            ping_interval=None,   # We send our own pings
            ping_timeout=None,
            close_timeout=5,
            max_size=2**20,
        ) as ws:
            result.connect_ms = round((time.monotonic() - t_conn_start) * 1000, 2)

            # Subscribe to a channel to get first message timing
            sub_msg = json.dumps({
                "type": "subscribe",
                "channel": "ticker",
                "assets": ["0xabc"],  # dummy; we just want timing
            })

            t_first = time.monotonic()
            await ws.send(sub_msg)
            _ = await asyncio.wait_for(ws.recv(), timeout=10)
            result.first_msg_ms = round((time.monotonic() - t_first) * 1000, 2)

            # Ping-pong RTT measurements
            for i in range(duration_pings):
                payload = f"ping_{i}_{int(time.time()*1000)}"
                t_ping = time.monotonic()
                try:
                    pong = await ws.ping()
                    await asyncio.wait_for(pong, timeout=5)
                    rtt = (time.monotonic() - t_ping) * 1000
                    result.ping_samples.append(WsLatencySample(
                        direction="echo",
                        timestamp_utc=ts_utc(),
                        latency_ms=round(rtt, 2),
                    ))
                except asyncio.TimeoutError:
                    result.disconnects += 1
                await asyncio.sleep(WS_PING_INTERVAL)

            rtts = [s.latency_ms for s in result.ping_samples if s.latency_ms > 0]
            if rtts:
                result.avg_rtt_ms = round(statistics.mean(rtts), 2)
                result.min_rtt_ms = round(min(rtts), 2)
                result.max_rtt_ms = round(max(rtts), 2)
                result.p99_rtt_ms = round(percentile(rtts, 99), 2)

    except Exception as e:
        result.error = str(e)
        if result.connect_ms == 0:
            result.connect_ms = round((time.monotonic() - t_conn_start) * 1000, 2)

    return result


# ── System Metrics ───────────────────────────────────────────────────────────

def get_system_metrics() -> SystemMetrics:
    try:
        import psutil
        return SystemMetrics(
            cpu_percent=round(psutil.cpu_percent(interval=0.5), 1),
            memory_percent=round(psutil.virtual_memory().percent, 1),
            platform=platform.platform(),
        )
    except ImportError:
        return SystemMetrics(
            cpu_percent=-1, memory_percent=-1,
            platform=platform.platform(),
        )


# ── ISP Info ─────────────────────────────────────────────────────────────────

def get_isp_info() -> dict[str, str]:
    info = {}
    try:
        import urllib.request
        with urllib.request.urlopen("https://ipinfo.io/json", timeout=5) as resp:
            data = json.loads(resp.read())
            info["ip"] = data.get("ip", "?")
            info["city"] = data.get("city", "?")
            info["region"] = data.get("region", "?")
            info["country"] = data.get("country", "?")
            info["org"] = data.get("org", "?")
    except Exception:
        info["error"] = "Could not fetch ISP info"
    return info


# ── Summary / Bottleneck Analysis ────────────────────────────────────────────

def generate_summary(report: DiagnosticReport) -> dict:
    s: dict = {"severity": "OK", "issues": [], "findings": []}

    # Check packet loss
    for p in report.ping_results:
        if p.loss_pct > 5:
            s["issues"].append(f"HIGH packet loss to {p.target}: {p.loss_pct}%")
            s["severity"] = "CRITICAL"
        elif p.loss_pct > 1:
            s["issues"].append(f"Moderate packet loss to {p.target}: {p.loss_pct}%")
            if s["severity"] == "OK":
                s["severity"] = "WARNING"

        # Jitter > 50ms is bad for WebSocket stability
        if p.jitter_ms > 50:
            s["issues"].append(f"HIGH jitter to {p.target}: {p.jitter_ms}ms")
            if s["severity"] != "CRITICAL":
                s["severity"] = "WARNING"
        elif p.jitter_ms > 20:
            s["findings"].append(f"Moderate jitter to {p.target}: {p.jitter_ms}ms")

        # RTT from PH to US should be ~180-250ms. >350ms = routing issue.
        if p.rtt_avg_ms > 350:
            s["issues"].append(f"High avg RTT to {p.target}: {p.rtt_avg_ms}ms (PH→US baseline ~200ms)")
            if s["severity"] == "OK":
                s["severity"] = "WARNING"

    # Check WebSocket RTT
    for w in report.ws_diagnostics:
        if w.error:
            s["issues"].append(f"WebSocket error: {w.error}")
            s["severity"] = "CRITICAL"
        if w.connect_ms > 2000:
            s["issues"].append(f"WebSocket connect slow: {w.connect_ms}ms")
        if w.p99_rtt_ms > 500:
            s["issues"].append(f"WebSocket p99 RTT high: {w.p99_rtt_ms}ms (ping-pong)")
        if w.disconnects > 0:
            s["issues"].append(f"WebSocket had {w.disconnects} ping timeouts")

    # Check API timings
    for a in report.api_timings:
        if a.error:
            s["issues"].append(f"API error on {a.endpoint}: {a.error}")
        if a.tls_ms > 500:
            s["findings"].append(f"Slow TLS to {a.endpoint}: {a.tls_ms}ms")
        if a.first_byte_ms > 2000:
            s["findings"].append(f"Slow TTFB to {a.endpoint}: {a.first_byte_ms}ms")

    # Check DNS
    for d in report.dns_results:
        if d.resolution_ms > 500:
            s["issues"].append(f"Slow DNS for {d.host}: {d.resolution_ms}ms")
        if d.error:
            s["issues"].append(f"DNS failure for {d.host}: {d.error}")

    # Bottleneck classification
    has_isp_issue = any(p.loss_pct > 1 or p.jitter_ms > 30 for p in report.ping_results)
    has_polymarket_delay = any(
        a.first_byte_ms > 1500 and a.error is None for a in report.api_timings
    )
    has_cloudflare_throttle = any(
        a.status_code in (429, 503, 403) for a in report.api_timings
    )
    has_local_issue = report.system_metrics.cpu_percent > 90 or report.system_metrics.memory_percent > 90

    s["bottleneck"] = {
        "isp_issue": has_isp_issue,
        "polymarket_backend_delay": has_polymarket_delay,
        "cloudflare_throttling": has_cloudflare_throttle,
        "local_device_issue": has_local_issue,
    }

    if not s["issues"]:
        s["findings"].append("No critical issues detected. Latency is baseline-expected for PH→US path.")

    return s


# ── Main ─────────────────────────────────────────────────────────────────────

async def main(duration_sec: int = 300, output_json: Optional[str] = None):
    print(f"[{ts_utc()}] PolyMarket Network Diagnostic — starting ({duration_sec}s window)")
    print(f"  Python: {sys.version}")
    print(f"  Platform: {platform.platform()}")

    isp_info = get_isp_info()
    print(f"  ISP: {isp_info.get('org', '?')} | {isp_info.get('city', '?')}, {isp_info.get('country', '?')}")

    # 1. DNS
    print("\n── DNS Resolution ──")
    dns_results = run_dns_diagnostics()
    for d in dns_results:
        status = f"{d.resolution_ms:.1f}ms → {d.ips[:2]}" if not d.error else f"ERROR: {d.error}"
        print(f"  {d.host}: {status}")

    # 2. Ping (parallel)
    print("\n── Ping Tests (30 packets each) ──")
    ping_targets = [
        "clob.polymarket.com",
        "gamma-api.polymarket.com",
        CLOUDFLARE_DNS,
        GOOGLE_DNS,
    ]
    ping_tasks = [run_ping(t) for t in ping_targets]
    ping_results = await asyncio.gather(*ping_tasks)
    for p in ping_results:
        print(f"  {p.target}: loss={p.loss_pct}% avg={p.rtt_avg_ms}ms "
              f"min={p.rtt_min_ms}ms max={p.rtt_max_ms}ms jitter={p.jitter_ms}ms")

    # 3. Traceroute
    print("\n── Traceroute ──")
    traceroute_results = []
    for target in ["clob.polymarket.com"]:
        tr = await run_traceroute(target)
        traceroute_results.append(tr)
        print(f"  {target}: {tr.total_hops} hops")
        for h in tr.hops[-5:]:  # last 5 hops
            rtt_str = f"{h.rtt1_ms or '?'}ms" if h.rtt1_ms else "*"
            print(f"    hop {h.hop:2d}: {h.ip or '*':20s} {rtt_str}")

    # 4. API Latency
    print("\n── API Latency (socket-level) ──")
    api_timings = await run_api_diagnostics()
    for a in api_timings:
        print(f"  {a.endpoint}: status={a.status_code} total={a.total_ms}ms "
              f"dns={a.dns_ms}ms connect={a.connect_ms}ms tls={a.tls_ms}ms ttfb={a.first_byte_ms}ms")

    # 5. WebSocket
    print(f"\n── WebSocket Diagnostics ({WS_PING_COUNT} pings @ {WS_PING_INTERVAL}s) ──")
    ws_diag = await run_ws_diagnostics(WS_PING_COUNT)
    ws_results: list[WsDiagnostic] = [ws_diag]
    if ws_diag.error:
        print(f"  ERROR: {ws_diag.error}")
    else:
        print(f"  connect: {ws_diag.connect_ms}ms  first_msg: {ws_diag.first_msg_ms}ms")
        print(f"  RTT: avg={ws_diag.avg_rtt_ms}ms min={ws_diag.min_rtt_ms}ms "
              f"max={ws_diag.max_rtt_ms}ms p99={ws_diag.p99_rtt_ms}ms")
        print(f"  disconnects/timeouts: {ws_diag.disconnects}")

    # 6. System
    print("\n── System Metrics ──")
    sys_metrics = get_system_metrics()
    print(f"  CPU: {sys_metrics.cpu_percent}%  Memory: {sys_metrics.memory_percent}%")

    # 7. Docker stats (if available)
    print("\n── Docker Container Resource Usage ──")
    await run_docker_stats()

    # 8. Assemble report
    report = DiagnosticReport(
        timestamp_utc=ts_utc(),
        local_ip=socket.gethostbyname(socket.gethostname()),
        isp_info=isp_info,
        dns_results=dns_results,
        ping_results=list(ping_results),
        traceroute_results=traceroute_results,
        api_timings=api_timings,
        ws_diagnostics=ws_results,
        system_metrics=sys_metrics,
        summary=generate_summary(None),  # set below
    )
    report.summary = generate_summary(report)

    # 9. Output
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Severity: {report.summary['severity']}")
    if report.summary["issues"]:
        print(f"  Issues ({len(report.summary['issues'])}):")
        for i in report.summary["issues"]:
            print(f"    [!] {i}")
    else:
        print("  No critical issues.")
    if report.summary["findings"]:
        print(f"  Findings ({len(report.summary['findings'])}):")
        for f in report.summary["findings"]:
            print(f"    [-] {f}")
    print(f"  Bottlenecks: {report.summary['bottleneck']}")

    if output_json:
        with open(output_json, "w") as f:
            json.dump(asdict(report), f, indent=2, default=str)
        print(f"\nFull report → {output_json}")

    return report


async def run_docker_stats():
    """Quick docker stats snapshot for the polymarket containers."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "stats", "--no-stream", "--format",
            "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
        for line in stdout.decode().split("\n")[:6]:  # header + 5 containers
            print(f"  {line}")
    except Exception:
        print("  (docker not available or not running)")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="PolyMarket Network Diagnostic")
    parser.add_argument("--duration", type=int, default=300, help="Test duration in seconds (default: 300)")
    parser.add_argument("--output", type=str, default=None, help="JSON output file path")
    args = parser.parse_args()

    import asyncio
    asyncio.run(main(args.duration, args.output))
