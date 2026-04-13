"""
Alert engine — runs continuously, evaluates rules, deduplicates, delivers.
"""

import asyncio
import logging
from datetime import datetime, timezone

from gse.scoring import GSEScorer
from .rules import AlertRuleEngine, AlertNotification
from .channels import AlertChannel, WebSocketChannel

logger = logging.getLogger(__name__)

# Deduplication window — same alert within this period is suppressed
DEDUP_WINDOW_SECONDS = 3600  # 1 hour
# Escalation timeout — if not acknowledged, escalate
ESCALATION_TIMEOUT_SECONDS = 900  # 15 minutes


class AlertEngine:
    """
    Continuous alert engine that evaluates GSE results against rules,
    deduplicates, and delivers via configured channels.
    """

    def __init__(self):
        self.scorer = GSEScorer()
        self.rule_engine = AlertRuleEngine()
        self.channels: list[AlertChannel] = []
        self.ws_channel = WebSocketChannel()
        self.channels.append(self.ws_channel)

        # Deduplication cache: rule_name:region_id → last_sent
        self._dedup: dict[str, datetime] = {}
        # Unacknowledged alerts
        self._pending: list[AlertNotification] = []
        # Alert history
        self._history: list[AlertNotification] = []
        # Lock for escalation check to prevent concurrent processing
        self._escalation_lock = asyncio.Lock()

    def add_channel(self, channel: AlertChannel) -> None:
        self.channels.append(channel)

    async def evaluate_and_notify(self) -> list[AlertNotification]:
        """Run one evaluation cycle: compute GSE → evaluate rules → deliver alerts."""
        all_results = await self.scorer.compute_all_regions()
        all_patterns = await self.scorer.detect_patterns()
        delivered: list[AlertNotification] = []

        for result in all_results:
            region_patterns = [p for p in all_patterns if p.region_id == result.region_id]
            notifications = self.rule_engine.evaluate(result, region_patterns)

            for notification in notifications:
                if self._is_duplicate(notification):
                    continue

                success = await self._deliver(notification)
                if success:
                    self._record_sent(notification)
                    delivered.append(notification)
                    self._pending.append(notification)
                    self._history.append(notification)

        # Check for escalation of unacknowledged alerts
        await self._check_escalation()

        # Trim history to last 1000 entries
        self._history = self._history[-1000:]

        return delivered

    async def run_loop(self, interval_seconds: float = 60.0) -> None:
        """Run the alert engine continuously."""
        logger.info("Alert engine started (interval: %.0fs)", interval_seconds)
        while True:
            try:
                delivered = await self.evaluate_and_notify()
                if delivered:
                    logger.info("Delivered %d alert(s)", len(delivered))
            except Exception as e:
                logger.error("Alert engine cycle failed: %s", e)
            await asyncio.sleep(interval_seconds)

    def acknowledge(self, alert_id: str) -> bool:
        """Acknowledge an alert to stop escalation."""
        for notification in self._pending:
            if notification.alert_id == alert_id:
                notification.acknowledged = True
                self._pending = [n for n in self._pending if n.alert_id != alert_id]
                return True
        return False

    def get_pending(self) -> list[dict]:
        """Get all pending (unacknowledged) alerts."""
        return [
            {
                "alertId": n.alert_id,
                "rule": n.rule_name,
                "priority": n.priority.value,
                "title": n.title,
                "message": n.message,
                "regionId": n.region_id,
                "timestamp": n.timestamp.isoformat(),
            }
            for n in self._pending
        ]

    def get_history(self, limit: int = 50) -> list[dict]:
        """Get recent alert history."""
        return [
            {
                "alertId": n.alert_id,
                "rule": n.rule_name,
                "priority": n.priority.value,
                "title": n.title,
                "message": n.message,
                "regionId": n.region_id,
                "timestamp": n.timestamp.isoformat(),
                "acknowledged": n.acknowledged,
            }
            for n in reversed(self._history[-limit:])
        ]

    def _is_duplicate(self, notification: AlertNotification) -> bool:
        """Check if this alert was recently sent."""
        key = f"{notification.rule_name}:{notification.region_id}"
        last_sent = self._dedup.get(key)
        if last_sent:
            elapsed = (datetime.now(timezone.utc) - last_sent).total_seconds()
            if elapsed < DEDUP_WINDOW_SECONDS:
                return True
        return False

    def _record_sent(self, notification: AlertNotification) -> None:
        key = f"{notification.rule_name}:{notification.region_id}"
        self._dedup[key] = datetime.now(timezone.utc)

    async def _deliver(self, notification: AlertNotification) -> bool:
        """Deliver to all channels. Returns True if at least one succeeded."""
        success = False
        for channel in self.channels:
            try:
                if await channel.send(notification):
                    success = True
            except Exception as e:
                logger.warning("Channel %s failed: %s", channel.channel_type, e)
        return success

    async def _check_escalation(self) -> None:
        """Escalate unacknowledged alerts past timeout."""
        async with self._escalation_lock:
            await self._do_check_escalation()

    async def _do_check_escalation(self) -> None:
        now = datetime.now(timezone.utc)
        for notification in self._pending:
            if notification.acknowledged:
                continue
            elapsed = (now - notification.timestamp).total_seconds()
            if elapsed > ESCALATION_TIMEOUT_SECONDS:
                escalation = AlertNotification(
                    alert_id=f"esc-{notification.alert_id}",
                    rule_name="escalation",
                    priority=notification.priority,
                    title=f"ESCALATED: {notification.title}",
                    message=f"Unacknowledged for {elapsed/60:.0f} min: {notification.message}",
                    region_id=notification.region_id,
                    metadata={"original_alert": notification.alert_id},
                )
                await self._deliver(escalation)
                notification.acknowledged = True  # Don't re-escalate
