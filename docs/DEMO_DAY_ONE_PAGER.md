# MuleShield | SIH26184

## Predict cash-out. Freeze funds. Dispatch response.

**MuleShield** is an AI-powered operational response system for mule-account fraud. It detects risk, identifies syndicates, predicts likely cash-out zones, and coordinates bank and police action during the **golden hour**.

| ₹48,021 Cr | 2.73M | 80% |
|---:|---:|---:|
| FY26 bank-fraud loss cited in team briefing | Reported fraud events cited in team briefing | Prototype Precision@Top-10 across cash-out cells |

## Four-device response architecture

```text
                 ┌───────────────────────────────────────┐
                 │ MuleShield HQ: models + FastAPI + SLA  │
                 │ Mule risk | GNN rings | 449-cell rank  │
                 └───────────────┬───────────────────────┘
                                 │ WebSocket events
       ┌─────────────────┬───────┼────────┬─────────────────┐
       ▼                 ▼       ▼        ▼                 ▼
 Investigator        Bank Officer       Admin          Field Terminal
 Case & zone         Sec.102 review     SLA/audit       Route & action
```

## Six steps in 30 seconds

1. Detect mule-risk signals from 18 features.
2. Link connected accounts into syndicates.
3. Rank likely cash-out zones across 449 grid cells.
4. Apply CRITICAL/HIGH/MEDIUM/LOW SLA escalation.
5. Prepare a Section 102 CrPC freeze workflow.
6. Dispatch the nearest field officer to the predicted zone.

## Five quick answers

| Judge asks | Answer |
|---|---|
| What is new? | **Predict, don’t just detect:** cash-out location plus coordinated response. |
| How accurate? | Controlled prototype: **80% Precision@Top-10**; production needs governed validation. |
| Why GNN? | Fraud is a network; we identify **syndicates, not isolated accounts**. |
| RBI overlap? | MuleShield **complements** MuleHunter by operationalising cash-out response. |
| Can it scale? | One HQ plus N authorised role clients; production replaces demo state with durable services. |

## Emergency contacts

- Team lead: ____________________  Phone: ____________________
- Technical support: _____________  Phone: ____________________
- Backup hotspot / device owner: _______________

**Prototype note:** Demonstration data and notification actions are simulated. Legal and bank actions remain with authorised officials.
