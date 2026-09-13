# MuleShield — Judge Q&A Pack

Use the short answer first. Expand only when asked. Metrics marked **prototype** are from the controlled evaluation and must not be represented as production-bank performance.

## 1. How is this different from RBI MuleHunter AI?

**Criterion:** Novelty / relevance  
**Short Answer (15s):** MuleHunter strengthens mule-account intelligence; MuleShield adds operational cash-out prediction, SLA-led bank workflow, and field dispatch. We complement the RBI ecosystem rather than replace it.  
**Detailed Answer (45s):** RBI’s MuleHunter deployment is reported across 31 banks in the team’s reference material. Our gap analysis is that account detection alone does not assign a likely withdrawal zone or coordinate the next responder. MuleShield consumes a risk event, predicts the likely cash-out area, and creates role-specific actions.  
**Data Point:** 31 banks in briefing reference; 449 response cells.

## 2. What is novel about cash-out prediction?

**Criterion:** Novelty  
**Short Answer (15s):** We predict a response location before cash-out, not only a suspicious account after funds have moved.  
**Detailed Answer (45s):** The output is a ranked geographic grid that can be handed to an investigator or field officer. That makes the model operational: police can prioritise a zone and banks can prioritise the connected freeze workflow.  
**Data Point:** 80% prototype Precision@Top-10.

## 3. Why use a GNN?

**Criterion:** Technical feasibility  
**Short Answer (15s):** Mule networks are relationships—accounts, transfers, devices, and beneficiaries—not independent rows.  
**Detailed Answer (45s):** Graph learning preserves those links and helps identify coordinated structures that a single-account classifier may miss. Our controlled graph view surfaces five rings, then contributes network context to the case.  
**Data Point:** 5 rings.

## 4. What makes MuleShield unique among fraud projects?

**Criterion:** Novelty / prototype  
**Short Answer (15s):** It closes the loop across four operational roles in under two seconds.  
**Detailed Answer (45s):** Most prototypes stop at a risk score or dashboard. Ours demonstrates investigator triage, bank freeze review, administrator SLA oversight, and field dispatch as one event flow.  
**Data Point:** 4 dashboards; <2-second target.

## 5. How exactly does it solve SIH26184?

**Criterion:** Relevance  
**Short Answer (15s):** SIH26184 asks where stolen funds will be cashed out; MuleShield ranks 449 possible areas and sends the leading zone to responders.  
**Detailed Answer (45s):** Cash-out prediction is the core Module D output, while the escalation and field modules turn it into a response. The prototype evaluation reaches 80% Precision@Top-10.  
**Data Point:** 449 cells; 80% Precision@Top-10.

## 6. What current gap are you addressing?

**Criterion:** Relevance  
**Short Answer (15s):** The gap is the time between a risk signal and coordinated intervention—minutes in our workflow versus reported multi-day manual cycles.  
**Detailed Answer (45s):** The team’s problem research cites 2.73 million fraud events and ₹48,021 crore losses; with that volume, staff need prioritised action rather than a long alert list. MuleShield assigns urgency, ownership, and location.  
**Data Point:** ₹48,021 crore; 2.73 million events (briefing figures).

## 7. Who uses it?

**Criterion:** Feasibility  
**Short Answer (15s):** I4C/state control rooms, investigators, bank officers, and field officers each use their own portal.  
**Detailed Answer (45s):** The role split limits clutter and supports least-privilege access. An I4C node can coordinate state police and participating banks while officers receive only assigned dispatch details.  
**Data Point:** 4 role clients.

## 8. How do you detect mule accounts?

**Criterion:** Technical feasibility  
**Short Answer (15s):** An ensemble evaluates 18 behavioural and transaction features, then adds graph context.  
**Detailed Answer (45s):** CatBoost, XGBoost, and LightGBM provide complementary tabular-model signals. AUC 1.0 is a synthetic-data result; with real, governed data we would expect validation in a more realistic .88–.92 range, not assume perfect performance.  
**Data Point:** 18 features; synthetic AUC 1.0.

## 9. Why 449 cells and a hybrid spatial approach?

**Criterion:** Technical feasibility  
**Short Answer (15s):** It gives an actionable resolution: broad enough to cover operations, granular enough to route a field officer.  
**Detailed Answer (45s):** We combine grid ranking, clustering such as DBSCAN, model outputs, and operational rules. This hybrid design is more resilient than asking one model to infer every spatial pattern.  
**Data Point:** 449 cells; 4 model/rule inputs.

## 10. What does 80% Precision@Top-10 mean?

**Criterion:** Prototype quality  
**Short Answer (15s):** In the controlled test, the true cash-out area appeared among the ten highest-ranked cells 80% of the time.  
**Detailed Answer (45s):** It is a response-ranking measure, not a promise of exact ATM prediction. Police can cover or investigate the top ranked zone set while the bank works the connected account controls.  
**Data Point:** 80% prototype Precision@Top-10.

## 11. Is 60 ms realistic?

**Criterion:** Feasibility  
**Short Answer (15s):** It is the measured prototype inference path on the demo workload, not an end-to-end production SLA.  
**Detailed Answer (45s):** Production latency will include authentication, data contracts, network, and audit storage. The architecture separates scoring from clients so it can be benchmarked and scaled independently.  
**Data Point:** 60 ms prototype model path.

## 12. How do you handle false positives?

**Criterion:** Responsible AI  
**Short Answer (15s):** Human review, confidence thresholds, explanations, and outcome feedback prevent an automated score from becoming an unchecked adverse action.  
**Detailed Answer (45s):** SHAP-style explanations and case context let officers see why a flag was raised. The 0.4 figure is a synthetic decision threshold example; production thresholds must be calibrated with banks, law enforcement, and legal governance.  
**Data Point:** 0.4 synthetic threshold example.

## 13. How do you address DPDP and security?

**Criterion:** Feasibility / compliance  
**Short Answer (15s):** Role-based access, minimised views, audit hashes, and clear retention governance are built into the rollout approach.  
**Detailed Answer (45s):** The prototype uses synthetic records. Production requires purpose limitation, access logging, retention policy, encryption, an air-gapped or approved deployment model, and DPDP-aligned data agreements.  
**Data Point:** SHA-256 audit concept; role-specific portals.

## 14. What is the stack?

**Criterion:** Technical feasibility  
**Short Answer (15s):** Python/FastAPI, CatBoost-family models, PyG graph analysis, React, maps, and WebSocket events.  
**Detailed Answer (45s):** The backend exposes 24+ prototype endpoints and a real-time hub. Each component is replaceable, which helps a government deployment avoid lock-in.  
**Data Point:** 24+ routes.

## 15. Can this scale nationally?

**Criterion:** Scale  
**Short Answer (15s):** Yes: one HQ service can publish to N authorised role clients, with state-wise partitions and a production event bus.  
**Detailed Answer (45s):** The demo has four clients, but the interaction is client-agnostic. Production would replace in-memory state with durable storage and WebSocket-only fanout with a pub/sub backbone.  
**Data Point:** 1 HQ + N clients.

## 16. What will it cost?

**Criterion:** Feasibility  
**Short Answer (15s):** The prototype relies primarily on open-source software; cost is dominated by secure infrastructure, integration, and operations.  
**Detailed Answer (45s):** A planning estimate for GPU/infrastructure is ₹8–15 lakh depending on volume and redundancy; maps may use a limited demo credit such as Google’s $200 tier. Procurement needs a proper capacity study.  
**Data Point:** ₹8–15 lakh planning range; $200 demo map credit.

## 17. How will you integrate with NCRP, SAHYOG, or CFCFRMS?

**Criterion:** Relevance / feasibility  
**Short Answer (15s):** Through approved data contracts and adapters, not direct uncontrolled access.  
**Detailed Answer (45s):** FastAPI routes and WebSocket events establish a prototype interface pattern. Production adapters would map case IDs, consent/authority fields, evidence records, and bank responses under agency agreements.  
**Data Point:** 24+ API routes plus WebSocket.

## 18. Does the field app work offline?

**Criterion:** Prototype  
**Short Answer (15s):** The PWA can cache its shell and assigned view; actions sync when connectivity returns.  
**Detailed Answer (45s):** The present demo uses LAN/WebSocket connectivity and external map tiles. A production field mode would cache the last 20 dispatches and use approved offline maps in an air-gapped policy.  
**Data Point:** 20-dispatch offline target.

## 19. Is the data real?

**Criterion:** Integrity  
**Short Answer (15s):** The demo uses realistic synthetic data; the application path is the same, but results are not represented as live bank performance.  
**Detailed Answer (45s):** This lets the team demonstrate 5,000 transactions and the workflow without personal financial data. Controlled synthetic evaluation is a starting point; production validation needs governed partner data.  
**Data Point:** 5,000 transactions; 60 ms prototype path.

## 20. Why four devices?

**Criterion:** Prototype / presentation  
**Short Answer (15s):** Fraud response is multi-owner; four displays prove the shared event reaches each owner without a manual relay.  
**Detailed Answer (45s):** Investigator, bank, admin, and field officer have different authority. The observed workflow target is under two seconds from critical event to distributed client visibility.  
**Data Point:** 4 clients; <2 seconds.

## 21. What if Wi-Fi fails during the demo?

**Criterion:** Feasibility  
**Short Answer (15s):** We have cached PWA screens, seeded cases, a hotspot, screenshots, and a recorded walkthrough.  
**Detailed Answer (45s):** The team will demonstrate the existing state, then explain the event sequence from the audit log. Production resilience would use durable queues and retry policies.  
**Data Point:** Offline cache target: 20 dispatches.

## 22. How does field verification feed back?

**Criterion:** Innovation  
**Short Answer (15s):** Arrival and action reports close the dispatch and become labelled outcome data for review.  
**Detailed Answer (45s):** That feedback supports post-incident audit and periodic retraining after approval. The model is not silently retrained from one officer action.  
**Data Point:** Dispatch → arrived → action workflow.

## 23. Describe the architecture in one sentence.

**Criterion:** Technical feasibility  
**Short Answer (15s):** A FastAPI intelligence HQ scores risk and location, then pushes governed role events to React portals over WebSocket.  
**Detailed Answer (45s):** Models are decoupled from UI, role clients are decoupled from each other, and the event/audit layer links their actions. That supports testing and a staged deployment.  
**Data Point:** 1 HQ + N clients.

## 24. What did Modules A–J take to build?

**Criterion:** Execution  
**Short Answer (15s):** Ten modules were planned over six weeks: data, detection, graph, prediction, orchestration, dashboards, SLA, field, and integration readiness.  
**Detailed Answer (45s):** The modular plan keeps model work separate from workflow and UI work, so each element can be evaluated and replaced independently. The full breakdown is available in the handout.  
**Data Point:** 10 modules; 6-week plan.

## 25. What is the biggest production challenge?

**Criterion:** Maturity  
**Short Answer (15s):** Replacing prototype in-memory state and direct WebSocket fanout with secure durable storage, pub/sub, and agency integrations.  
**Detailed Answer (45s):** That is an engineering and governance task, not a claim that the demo is already national infrastructure. We have designed clear seams for that migration.  
**Data Point:** In-memory prototype → durable event architecture.
