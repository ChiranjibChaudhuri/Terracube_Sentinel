"""
Alert delivery channels — WebSocket, Webhook, Email, SMS.
"""

import os
import json
import logging
from abc import ABC, abstractmethod

import httpx

from agents.alerting.rules import AlertNotification

logger = logging.getLogger(__name__)


class AlertChannel(ABC):
    """Abstract base for alert delivery channels."""

    @property
    @abstractmethod
    def channel_type(self) -> str:
        ...

    @abstractmethod
    async def send(self, notification: AlertNotification) -> bool:
        """Send an alert notification. Returns True on success."""
        ...


class WebSocketChannel(AlertChannel):
    """Push alerts via WebSocket to connected frontend clients."""

    channel_type = "websocket"

    def __init__(self):
        self._connections: list = []

    def register(self, websocket) -> None:
        self._connections.append(websocket)

    def unregister(self, websocket) -> None:
        self._connections = [ws for ws in self._connections if ws != websocket]

    async def send(self, notification: AlertNotification) -> bool:
        payload = json.dumps({
            "type": "alert",
            "data": {
                "alertId": notification.alert_id,
                "rule": notification.rule_name,
                "priority": notification.priority.value,
                "title": notification.title,
                "message": notification.message,
                "regionId": notification.region_id,
                "timestamp": notification.timestamp.isoformat(),
                "metadata": notification.metadata,
            },
        })
        sent = 0
        dead = []
        for ws in self._connections:
            try:
                await ws.send_text(payload)
                sent += 1
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections.remove(ws)
        logger.info("WebSocket alert sent to %d/%d clients", sent, sent + len(dead))
        return sent > 0


class WebhookChannel(AlertChannel):
    """Send alerts to external webhooks (Slack, Discord, Teams)."""

    channel_type = "webhook"

    def __init__(self, webhook_url: str | None = None, platform: str = "generic"):
        self.webhook_url = webhook_url or os.getenv("ALERT_WEBHOOK_URL", "")
        self.platform = platform

    async def send(self, notification: AlertNotification) -> bool:
        if not self.webhook_url:
            logger.warning("No webhook URL configured — skipping")
            return False

        payload = self._format_payload(notification)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(self.webhook_url, json=payload)
                resp.raise_for_status()
                return True
        except Exception as e:
            logger.warning("Webhook delivery failed: %s", e)
            return False

    def _format_payload(self, notification: AlertNotification) -> dict:
        if self.platform == "slack":
            color = {"CRITICAL": "#ef4444", "HIGH": "#f97316", "MEDIUM": "#eab308", "LOW": "#22c55e"}
            return {
                "attachments": [{
                    "color": color.get(notification.priority.value, "#6b7280"),
                    "title": notification.title,
                    "text": notification.message,
                    "fields": [
                        {"title": "Region", "value": notification.region_id, "short": True},
                        {"title": "Priority", "value": notification.priority.value, "short": True},
                    ],
                    "ts": int(notification.timestamp.timestamp()),
                }],
            }
        elif self.platform == "discord":
            color_map = {"CRITICAL": 0xEF4444, "HIGH": 0xF97316, "MEDIUM": 0xEAB308, "LOW": 0x22C55E}
            return {
                "embeds": [{
                    "title": notification.title,
                    "description": notification.message,
                    "color": color_map.get(notification.priority.value, 0x6B7280),
                    "fields": [
                        {"name": "Region", "value": notification.region_id, "inline": True},
                        {"name": "Priority", "value": notification.priority.value, "inline": True},
                    ],
                }],
            }
        # Generic
        return {
            "alert_id": notification.alert_id,
            "priority": notification.priority.value,
            "title": notification.title,
            "message": notification.message,
            "region_id": notification.region_id,
            "timestamp": notification.timestamp.isoformat(),
        }


class EmailChannel(AlertChannel):
    """Send alerts via SMTP email."""

    channel_type = "email"

    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_pass = os.getenv("SMTP_PASS", "")
        self.from_addr = os.getenv("ALERT_FROM_EMAIL", "sentinel@terracube.io")
        self.to_addrs = os.getenv("ALERT_TO_EMAILS", "").split(",")

    async def send(self, notification: AlertNotification) -> bool:
        if not self.smtp_host or not self.to_addrs[0]:
            logger.info("Email not configured — skipping")
            return False

        try:
            import smtplib
            from email.mime.text import MIMEText

            msg = MIMEText(
                f"{notification.title}\n\n{notification.message}\n\n"
                f"Region: {notification.region_id}\n"
                f"Priority: {notification.priority.value}\n"
                f"Time: {notification.timestamp.isoformat()}"
            )
            msg["Subject"] = f"[{notification.priority.value}] {notification.title}"
            msg["From"] = self.from_addr
            msg["To"] = ", ".join(self.to_addrs)

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                if self.smtp_user:
                    server.starttls()
                    server.login(self.smtp_user, self.smtp_pass)
                server.send_message(msg)
            return True
        except Exception as e:
            logger.warning("Email delivery failed: %s", e)
            return False
