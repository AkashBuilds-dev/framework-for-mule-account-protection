# MuleShield Demo-Day Checklist

## Two hours before

- [ ] Charge all laptops, field phone, hotspot, and power banks.
- [ ] Pack chargers, extension board/power strips, HDMI adapters, mouse, and backup hotspot.
- [ ] Confirm four visible clients: Investigator `/`, Bank `/bank`, Admin `/admin`, Field `/field`.
- [ ] Test Google/map tiles and a fallback screenshot/recorded walkthrough.
- [ ] Confirm all devices join the same LAN; note HQ IP and port 8000.
- [ ] Rehearse the CRITICAL cascade once and reset to seeded state if required.
- [ ] Copy this docs folder, screenshots, and demo video to two offline drives.
- [ ] Print four one-pagers and speaker cue cards.

## Thirty minutes before

- [ ] Start backend: `python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000`
- [ ] Start frontend: `cd frontend && npm run dev -- --host 0.0.0.0`
- [ ] Open Investigator `/`, Bank `/bank`, Admin `/admin`, and Field `/field`.
- [ ] On the phone, use the Field Terminal PWA/fullscreen view at 375px width.
- [ ] Trigger one controlled CRITICAL alert; confirm alert, freeze request, SLA record, and dispatch.
- [ ] Check browser consoles and backend terminal for errors.
- [ ] Set screen brightness high; connect power; enable Do Not Disturb.
- [ ] Verify local IP URLs are correct on every client.

## Five minutes before

- [ ] Put each device on its assigned starting screen; do not leave dev tools visible.
- [ ] Clear irrelevant notifications, tabs, and personal browser content.
- [ ] Check the seeded SLA figures and live timers are readable.
- [ ] Place the backup video and screenshots one click away.
- [ ] Speaker 2 confirms the exact **Simulate CRITICAL Alert** button location.
- [ ] Speaker 1 has the opening number and Speaker 3 has the closing line ready.

## During the demo

| Person | Position | Responsibility |
|---|---|---|
| Speaker 1 | Centre / Investigator | Opening, architecture, close |
| Speaker 2 | Beside four screens | Live clicks and transitions |
| Speaker 3 | Bank/Admin side | Impact, compliance, scale |
| Optional support | Behind demo station | Backend, hotspot, reset only—no speaking unless asked |

## Recovery order

1. If a screen is stale, refresh the client and show the Admin audit/SLA record.
2. If the event does not arrive, use the existing seeded critical case and state: “We will show the recorded event state to preserve time.”
3. If LAN fails, use the hotspot, then screenshots/video.
4. If maps fail, show the destination, ETA, and route screenshot; do not wait for map tiles.
