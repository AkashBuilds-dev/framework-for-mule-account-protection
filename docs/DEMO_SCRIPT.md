# MuleShield — 8-Minute Demo Script

**SIH26184 | Mule Account Detection & Predictive Cash-Out Intelligence**  
**Speakers:** Speaker 1 — problem and architecture; Speaker 2 — innovation and live workflow; Speaker 3 — impact and deployment.  
**Demo principle:** narrate only what is visible on the four role screens.

| Time | Speaker | Screen state / click |
|---|---|---|
| 0:00–0:45 | 1 | Title slide; Investigator portal ready |
| 0:45–2:00 | 1 | Architecture / Investigator dashboard |
| 2:00–2:30 | 2 | Transition to live system |
| 2:30–6:30 | 2 | Investigator → Bank → Admin → Field |
| 6:30–7:30 | 3 | Impact / scale slide |
| 7:30–8:00 | 1 | Closing slide |

## 0:00–0:45 — The problem

**Speaker 1:**

> Good morning, respected judges. In FY26, India lost **₹48,021 crore** to bank frauds. That is **₹5.5 crore every hour**.  
> Imagine a Bengaluru professor who loses ₹75,000 through a UPI scam. Before the complaint reaches an investigator, the money is moved through mule accounts and withdrawn in Jamtara—2,000 kilometres away. The decisive window is not days; it is the **golden hour**.  
> SIH26184 asks us to predict **where** stolen money will be cashed out before it happens. Existing systems can flag suspicious accounts, but there is no operational response system that turns that signal into a bank freeze and field action.  
> **MuleShield** predicts cash-out zones in **60 milliseconds** and coordinates police, bank, administrator, and field response in **under two seconds**.

**Screen action:** Hold on the title; switch to the Investigator portal on the final sentence.

## 0:45–2:00 — How MuleShield works

**Speaker 1:**

> MuleShield runs as one HQ intelligence node with four role-specific dashboards. First, our mule detector evaluates **18 behavioural and transaction features** through a CatBoost, XGBoost, and LightGBM ensemble.  
> Second, a Graph Neural Network identifies connected syndicates—not isolated suspicious accounts. In this prototype it reveals **five mule rings**.  
> Third, the cash-out predictor ranks **449 geographic grid cells**. Our measured prototype result is **80% Precision@Top-10**: the likely withdrawal zone is surfaced before the withdrawal is completed.  
> Fourth, every alert enters a four-tier SLA matrix: CRITICAL in 5 minutes, HIGH in 15, MEDIUM in 60, and LOW in 1,440 minutes.  
> Fifth, a CRITICAL case prepares a Section 102 CrPC freeze request for the bank officer.  
> Sixth, the nearest field officer receives the dispatch with routing to the predicted cash-out point.  
> The dashboards share events over WebSocket, so this is a distributed response loop, not a static report.

**Screen action:** Point to risk, syndicate, predicted zone, SLA, and alert panels in order.

## 2:00–2:30 — Why this is different

**Speaker 2:**

> Here is what makes MuleShield different. First, we identify **syndicates, not just accounts**, using graph intelligence. Second, we **predict, not just detect**: the exact outcome SIH26184 asks for is the future cash-out zone. Third, our response is distributed in real time—investigator, bank, administrator, and field officer see the same incident in under two seconds.

**Screen action:** Move to the Investigator device. Confirm Bank, Admin, and Field devices are already open.

## 2:30–6:30 — Live critical-alert cascade

**Speaker 2 — Investigator (2:30–3:20):**

> This is the Investigator dashboard. We will create a controlled CRITICAL scenario: risk score **0.95**, amount **₹75,000**. I click **Simulate CRITICAL Alert**.

**Click:** `⚠ Simulate CRITICAL Alert`.

> The system has created case **M00001**. The model ranks the predicted cash-out zone; for today’s scripted demo we show the Kolar-area scenario. Notice the five-minute SLA and the automatic escalation events: alert, field dispatch, and freeze pending.

**Speaker 2 — Bank (3:20–4:10):**

> On the Bank Officer dashboard, that same case is already at the top because rows are sorted by SLA deadline. MuleShield has generated a **Section 102 CrPC** freeze request, with SMS and call notifications recorded as mocks in this prototype. The timer is live—approximately **4:23** remains. The officer can review and approve the suggested freeze instead of reconstructing the chain manually.

**Click:** Review/approve the visible freeze action if the demo state permits. Otherwise point to `FREEZE_PENDING`.

**Speaker 2 — Admin (4:10–5:00):**

> The Admin Console sees the same escalation in its SLA dashboard. Compliance is currently shown at **96%** in the seeded demo data; the new CRITICAL item appears in Recent Escalations and its countdown updates every second. Below the operations view, Row 7 is our drift monitor, showing whether transaction behaviour is departing from the training distribution. This is how a supervisor audits both response quality and model health.

**Speaker 2 — Field (5:00–6:30):**

> On the I4C Field Terminal, the assigned officer sees the case amount, severity, predicted city, SLA, and distance—about **2.3 kilometres** in this controlled route. I select **Navigate**.  
> The map renders the officer as a blue live-position marker, the predicted ATM as a red destination pin, and a curved route with turn-by-turn instructions. When we press **Start Navigation**, the mock officer position advances along the route. On arrival, the officer records field action, creating an auditable handoff back to HQ.  
> One simulated alert has now produced an investigator case, a bank freeze request, an administrator SLA record, and a field dispatch—without waiting for a manual phone-tree.

**Fallback phrases:**

- “The live WebSocket event has been received; this screen is refreshing its current state.”
- “To protect the timing of the presentation, we will show the already-generated incident visible on this dashboard.”
- “The route is a controlled GPS simulation; the operational output is the assigned destination, ETA, and audit trail.”
- “The API event log on the Admin screen confirms the same cascade independently of this client view.”

## 6:30–7:30 — Impact and deployment

**Speaker 3:**

> Today, a fraud report may move from detection to field action over days. MuleShield compresses that into minutes, protecting the golden hour when cash-out can still be interrupted.  
> It complements RBI MuleHunter AI: MuleHunter strengthens account-level intelligence; MuleShield operationalises the next question—where funds may be withdrawn and who must act now.  
> The architecture is designed for national scale: **one HQ node plus N role clients**, with role-based access, audit hashes, DPDP-aware data minimisation, and Section 102-ready workflow. A state police unit can begin with one control room and expand without changing the field experience.

## 7:30–8:00 — Close

**Speaker 1:**

> MuleShield turns fraud intelligence into coordinated intervention: **predict the cash-out zone, freeze the funds, and dispatch the response during the golden hour**. We are ready to demonstrate the system and answer your questions. Thank you.

## Speaker assignments

| Speaker | Owns | Must rehearse |
|---|---|---|
| 1 | Problem, six-step architecture, close | Opening numbers, SIH26184 outcome, transitions |
| 2 | Differentiation and live cascade | Exact button locations, fallback path, four-screen timing |
| 3 | Impact, compliance, scaling | RBI complement statement, national deployment, Q&A handoff |

## 30-second pitch

> MuleShield is an I4C-ready fraud-response system for SIH26184. It detects mule accounts, finds syndicates with a GNN, and predicts likely cash-out zones across 449 cells in 60 milliseconds. A critical event automatically creates a five-minute SLA, a Section 102 freeze workflow, and a field dispatch. Four dashboards update in under two seconds so investigators, banks, administrators, and officers act during the golden hour.
