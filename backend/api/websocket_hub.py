"""
==============================================================================
MuleShield (SIH26184) - Module E: Real-Time WebSocket Hub & Event Broadcaster
==============================================================================
Manages role-specific real-time WebSocket connections:
- Roles: investigator, bank, admin, field
- Channels: NEW_ALERT, FREEZE_APPROVED, CASE_UPDATED, FIELD_DISPATCH
- Connection telemetry, automatic ping/pong keepalive, and LAN multicasting.
==============================================================================
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger("muleshield.websocket")


class WebSocketHub:
    """
    Central WebSocket Connection Manager & Broadcast Hub for MuleShield.
    Maintains active connections per role and broadcasts real-time threat intelligence.
    """

    def __init__(self):
        # Maps client_id -> WebSocket
        self.active_sockets: Dict[str, WebSocket] = {}
        # Maps client_id -> metadata dict (client_type, ip, connected_at)
        self.client_meta: Dict[str, Dict[str, Any]] = {}
        # Maps client_type -> Set of client_ids
        self.role_subscribers: Dict[str, Set[str]] = {
            "investigator": set(),
            "bank": set(),
            "admin": set(),
            "field": set(),
        }
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, client_type: str, client_id: str, client_ip: str):
        """Accepts a new WebSocket connection, registers metadata, and logs connection event."""
        await websocket.accept()
        normalized_role = client_type.lower().strip()
        if normalized_role not in self.role_subscribers:
            self.role_subscribers[normalized_role] = set()

        async with self._lock:
            self.active_sockets[client_id] = websocket
            self.role_subscribers[normalized_role].add(client_id)
            self.client_meta[client_id] = {
                "client_id": client_id,
                "client_type": normalized_role,
                "ip": client_ip,
                "connected_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }

        connect_msg = f"Client {client_id} ({normalized_role}) connected from {client_ip}"
        print(f"[WEBSOCKET] {connect_msg}")
        logger.info(connect_msg)
        self._log_to_file(connect_msg)

        # Send initial welcome payload with channel capabilities
        welcome_payload = {
            "event": "CONNECTED",
            "client_id": client_id,
            "role": normalized_role,
            "server_time": datetime.now().isoformat(),
            "available_channels": [
                "NEW_ALERT",
                "FREEZE_APPROVED",
                "CASE_UPDATED",
                "FIELD_DISPATCH",
                "SLA_WARNING",
                "SLA_BREACH",
                "ESCALATION_BUMP",
                "FREEZE_PENDING",
            ],
            "message": f"Successfully linked to MuleShield Command Hub as '{normalized_role}'",
        }
        await websocket.send_text(json.dumps(welcome_payload))

    async def disconnect(self, client_id: str):
        """Unregisters client on disconnect and frees socket references."""
        async with self._lock:
            if client_id in self.active_sockets:
                ws = self.active_sockets.pop(client_id, None)
                meta = self.client_meta.pop(client_id, {})
                role = meta.get("client_type", "unknown")
                if role in self.role_subscribers and client_id in self.role_subscribers[role]:
                    self.role_subscribers[role].remove(client_id)

                disconnect_msg = f"Client {client_id} disconnected"
                print(f"[WEBSOCKET] {disconnect_msg}")
                logger.info(disconnect_msg)
                self._log_to_file(disconnect_msg)

    async def broadcast(self, channel: str, data: Dict[str, Any], roles: Optional[List[str]] = None):
        """
        Broadcasts an event to all connected clients or filtered by designated roles.
        Channels: NEW_ALERT, FREEZE_APPROVED, CASE_UPDATED, FIELD_DISPATCH
        """
        message_dict = {
            "channel": channel,
            "timestamp": datetime.now().isoformat(),
            "payload": data,
        }
        payload_text = json.dumps(message_dict)

        target_client_ids: Set[str] = set()
        async with self._lock:
            if roles:
                for r in roles:
                    target_client_ids.update(self.role_subscribers.get(r.lower(), set()))
            else:
                target_client_ids = set(self.active_sockets.keys())

        # Discard stale connections gracefully during broadcast
        dead_clients = []
        for cid in target_client_ids:
            ws = self.active_sockets.get(cid)
            if ws:
                try:
                    await ws.send_text(payload_text)
                except Exception as exc:
                    logger.warning(f"Failed to send to client {cid}: {exc}")
                    dead_clients.append(cid)

        for dc in dead_clients:
            await self.disconnect(dc)

        # A CRITICAL alert always receives a nearest-officer dispatch. Keep this
        # in the hub so every escalation source (manual, simulated, or ML) has
        # the same field response behaviour.
        if channel == "NEW_ALERT" and data.get("severity") == "CRITICAL":
            from backend.api import state
            dispatch = state.create_field_dispatch(data)
            await self.broadcast("FIELD_DISPATCH", dispatch, roles=["field", "investigator", "admin"])

    def get_connected_count(self) -> int:
        """Returns total active WebSocket connections."""
        return len(self.active_sockets)

    def get_connected_clients(self) -> List[Dict[str, Any]]:
        """Returns list of all connected client metadata."""
        return list(self.client_meta.values())

    def _log_to_file(self, message: str):
        """Appends WebSocket connection logs to backend/api/logs.txt."""
        try:
            from pathlib import Path
            log_path = Path(__file__).resolve().parent / "logs.txt"
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(log_path, "a", encoding="utf-8") as f:
                f.write(f"[{ts}] [WEBSOCKET] {message}\n")
        except Exception:
            pass


# Global Singleton WebSocket Hub
ws_hub = WebSocketHub()
