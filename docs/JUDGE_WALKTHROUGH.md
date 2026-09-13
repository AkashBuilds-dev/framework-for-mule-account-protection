# MuleShield — Judge Walkthrough

## 1. Elevator pitch — 30 seconds

MuleShield is an SIH26184 response system that turns mule-account intelligence into intervention. It detects behavioural risk, finds connected syndicates, ranks likely cash-out zones across 449 cells, and pushes a critical case to investigators, banks, administrators, and field officers in under two seconds. The operational objective is simple: **predict the cash-out, freeze the funds, and dispatch during the golden hour**.

## 2. Problem deep dive

- Team briefing figures cite **₹48,021 crore** in FY26 bank-fraud loss and **2.73 million** fraud events.
- A victim’s funds may cross mule layers before a traditional investigation reaches the likely cash-out location.
- Account detection by itself does not answer: **where will the money be withdrawn, who acts, and how quickly?**
- SIH26184 specifically requires predictive cash-out intelligence, which is the central output of MuleShield.

## 3. Solution — two minutes

1. Score transactions/accounts from 18 behavioural signals.
2. Detect connected rings with graph intelligence.
3. Rank 449 likely cash-out cells; prototype Precision@Top-10 is 80%.
4. Apply four-tier escalation: CRITICAL/HIGH/MEDIUM/LOW.
5. Create a bank freeze review and notification record for a critical case.
6. Send the leading predicted zone to the assigned field terminal.

**Show:** Investigator → click critical alert → Bank queue → Admin SLA → Field route.

## 4. Architecture

```text
  Data + ML models                 MuleShield HQ
  ┌───────────────┐          ┌─────────────────────────┐
  │ Ensemble risk │ ───────► │ FastAPI / event hub      │
  │ GNN rings     │ ───────► │ cases / SLA / audit      │
  │ spatial rank  │ ───────► │ WebSocket publish layer  │
  └───────────────┘          └───────────┬─────────────┘
                                         │
           ┌───────────┬───────────┬─────┴──────┬──────────────┐
           ▼           ▼           ▼            ▼              
       Investigator  Bank       Admin        Field PWA          
       triage/zone   freeze     SLA/audit    route/report        
```

- **Backend:** FastAPI coordinates model results, case state, escalations, and APIs.
- **Frontend:** React delivers four least-privilege role views.
- **Real time:** WebSocket delivers the critical-alert cascade; production evolves to durable pub/sub.
- **Distributed:** One HQ node can serve N authorised clients on a LAN or approved network.

## 5. Modules A–J — what judges may ask

| Module | Judge may ask | Answer hint |
|---|---|---|
| A Data | Is it real data? | Synthetic demo data; governed real-data validation is the next stage. |
| B Detection | How do you score risk? | 18 features + CatBoost/XGBoost/LightGBM ensemble. |
| C Graph | Why graph? | Mule fraud is a connected network; prototype surfaces 5 rings. |
| D Prediction | What makes it SIH-specific? | 449-cell cash-out ranking; 80% prototype Precision@Top-10. |
| E Backend | Can it integrate? | FastAPI interfaces, 24+ routes, event-oriented workflow. |
| F Investigator | Who starts action? | Investigator sees case, zone, evidence, and escalation. |
| G Bank/Admin | Why separate portals? | Separate authority: freeze review vs oversight/audit. |
| H Escalation | Is it automatic? | Alert workflow is automatic; authorised officers retain legal decisions. |
| I Field PWA | Is it useful on ground? | Dispatch, route, ETA, arrival, and action report. |
| J Integration | Is this deployable? | Four-client demo; durable storage/pub-sub and agency adapters are the next steps. |

## 6. Q&A — answer in time

- Use [JUDGE_QA.md](JUDGE_QA.md) for all 25 answers.
- Start with the 15-second answer; expand only to the 45-second answer if the judge asks.
- For accuracy or AI questions, say **“prototype evaluation”** and explain the validation plan.
- For legal questions, say Section 102 workflow is a preparation/decision-support path; it is not an unsupervised legal action.

## 7. Evaluation mapping — 100 points

| Criterion | What judges score | How MuleShield demonstrates it | Evidence / talking point |
|---|---|---|---|
| Novelty — 20 | Differentiated idea | Predictive cash-out + response cascade | **Predict, don’t just detect.** |
| Relevance — 15 | Fit to SIH26184 | Likely cash-out zone is the core output | 449 cells; field route |
| Technical feasibility — 15 | Credible implementation | Ensemble, GNN, FastAPI, role UI | 24+ APIs; modular architecture |
| Scale — 15 | Adoption path | 1 HQ + N clients; replaceable components | Statewise/agency partition plan |
| Prototype — 20 | Working end-to-end system | Critical alert across four roles | <2-second cascade target |
| Presentation — 15 | Clear story and control | 8-minute script, measured claims, fallbacks | Golden-hour narrative |

## 8. Setup steps

1. Connect HQ, bank, admin, investigator, and field devices to the same LAN/hotspot.
2. Start backend: `python -m uvicorn backend.api.main:app --host 0.0.0.0 --port 8000`.
3. Start frontend: `cd frontend && npm run dev -- --host 0.0.0.0`.
4. Open `/`, `/bank`, `/admin`, and `/field`; use HQ IP on secondary devices as needed.
5. Confirm maps, live timers, and one seeded dispatch.
6. Run one controlled CRITICAL alert before judges enter; keep the event record available.
7. Set brightness, DND, power, and backup video/screenshots.

## 9. Ten phrases to land

1. **Predict, don’t just detect.**
2. **Syndicates, not individual accounts.**
3. **Golden hour.**
4. **60 milliseconds** for the prototype prediction path.
5. **Two seconds** for the distributed event target.
6. **Section 102 CrPC** workflow.
7. **80% Precision@Top-10** in controlled evaluation.
8. **Complements RBI**; does not claim replacement.
9. **National scale: one HQ plus N clients.**
10. **Infrastructure for response, not another alert dashboard.**

## 10. What not to say

- Do not call synthetic AUC 1.0 a real-bank result.
- Do not say a model automatically freezes an account or overrides legal authority.
- Do not claim direct live integration with NCRP, SAHYOG, CFCFRMS, RBI, or banks unless it is live and authorised.
- Do not promise 80% exact-ATM accuracy; explain it as Precision@Top-10 cells.
- Do not say “AI catches all fraud.”
- Do not introduce consumer-phone branding; call the mobile view the **I4C Field Terminal**.

## 11. Backup plan

- **WebSocket issue:** show seeded critical case and Admin audit/SLA evidence.
- **Network issue:** switch to hotspot; use cached PWA screen, screenshots, then video.
- **Map issue:** show predicted destination, ETA, route screenshot, and field action form.
- **Model delay:** use an existing demonstrated case and explain the recorded result; do not wait silently.
- **Question beyond scope:** state the prototype boundary, then give the production migration step.

## 12. Post-demo next steps

1. Run a governed pilot with one bank and one state cybercrime unit.
2. Establish data-sharing, retention, security, and Section 102 operating procedures.
3. Replace in-memory demo state with encrypted durable storage and pub/sub.
4. Validate calibration, false positives, geographic fairness, and drift on approved real data.
5. Add approved NCRP/SAHYOG/CFCFRMS adapters and resilient offline maps.
