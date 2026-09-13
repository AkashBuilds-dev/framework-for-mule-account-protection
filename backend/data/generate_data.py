"""
==============================================================================
MuleShield (SIH26184) - Module A: Synthetic Cybercrime Data Generator
==============================================================================
Generates high-fidelity synthetic datasets for:
1. victims.csv       - 500 victim records with geo-coordinates, fraud types, and complaint logs.
2. accounts.csv      - 1,700 accounts (200 MULE + 1,000 LEGIT + 500 VICTIM accounts)
                       with KYC match scores, device clustering, syndicate tags.
3. transactions.csv  - 5,000 records (3,500 fraud [victim->mule + mule ring layering], 1,500 legit)
4. atms.csv          - 150 ATMs across 8 Indian hubs with geo-coordinates and bank tags.
5. withdrawals.csv   - Target variable: rapid cash-out events (70% syndicate hubs, 30% local).

Deterministic seed = 42 for complete reproducibility during hackathon evaluations.
==============================================================================
"""

import os
import sys
import random
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from faker import Faker

# ==============================================================================
# GLOBAL CONSTANTS & DETERMINISTIC SEED CONFIGURATION
# ==============================================================================
SEED = 42
np.random.seed(SEED)
random.seed(SEED)
Faker.seed(SEED)
fake = Faker("en_IN")

# Target Output Directory (backend/data/)
OUTPUT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 13 Selected Indian Cities (Mixed North + South Setup)
CITY_CONFIG = {
    # NORTH INDIA (keep as-is)
    "Gurugram":   {"lat": 28.4595, "lon": 77.0266, "radius": 0.06, "is_syndicate_hub": True,  "region": "NORTH"},
    "Noida":      {"lat": 28.5355, "lon": 77.3910, "radius": 0.06, "is_syndicate_hub": True,  "region": "NORTH"},
    "Jamtara":    {"lat": 23.9625, "lon": 86.8029, "radius": 0.04, "is_syndicate_hub": True,  "region": "NORTH"},
    "Mewat":      {"lat": 28.1090, "lon": 76.9950, "radius": 0.05, "is_syndicate_hub": True,  "region": "NORTH"},
    "Mumbai":     {"lat": 19.0760, "lon": 72.8777, "radius": 0.09, "is_syndicate_hub": False, "region": "WEST"},
    "Kolkata":    {"lat": 22.5726, "lon": 88.3639, "radius": 0.07, "is_syndicate_hub": False, "region": "EAST"},
    # SOUTH INDIA (new)
    "Bengaluru":  {"lat": 12.9716, "lon": 77.5946, "radius": 0.08, "is_syndicate_hub": True,  "region": "SOUTH"},
    "Hyderabad":  {"lat": 17.3850, "lon": 78.4867, "radius": 0.08, "is_syndicate_hub": True,  "region": "SOUTH"},
    "Chennai":    {"lat": 13.0827, "lon": 80.2707, "radius": 0.07, "is_syndicate_hub": True,  "region": "SOUTH"},
    "Kolar":      {"lat": 13.1357, "lon": 78.1325, "radius": 0.04, "is_syndicate_hub": True,  "region": "SOUTH"},
    "Nellore":    {"lat": 14.4426, "lon": 79.9865, "radius": 0.05, "is_syndicate_hub": True,  "region": "SOUTH"},
    "Coimbatore": {"lat": 11.0168, "lon": 76.9558, "radius": 0.06, "is_syndicate_hub": False, "region": "SOUTH"},
    "Kochi":      {"lat": 9.9312,  "lon": 76.2673, "radius": 0.06, "is_syndicate_hub": False, "region": "SOUTH"},
}

ALL_CITIES = list(CITY_CONFIG.keys())
SYNDICATE_HUB_CITIES = [c for c, cfg in CITY_CONFIG.items() if cfg["is_syndicate_hub"]]
NORTH_HUB_CITIES = [c for c, cfg in CITY_CONFIG.items() if cfg["is_syndicate_hub"] and cfg["region"] == "NORTH"]
SOUTH_HUB_CITIES = [c for c, cfg in CITY_CONFIG.items() if cfg["is_syndicate_hub"] and cfg["region"] == "SOUTH"]

FRAUD_TYPES = [
    "UPI Impersonation Fraud",
    "Electricity Bill Threat Scam",
    "Part-time Telegram Job Scam",
    "Digital Arrest / CBI Impersonation",
    "KYC / SIM Block Extortion",
    "Fake Loan App Fraud",
    "Investment / Crypto Token Scam",
    "Customer Care Search Hijack",
]

BANKS = [
    "State Bank of India",
    "HDFC Bank",
    "ICICI Bank",
    "Punjab National Bank",
    "Axis Bank",
    "Bank of Baroda",
    "Canara Bank",
    "Union Bank of India",
]

AREA_TYPES = [
    "COMMERCIAL_MARKET",
    "RESIDENTIAL_COLONY",
    "HIGHWAY_OUTSKIRTS",
    "RURAL_JUNCTION",
    "TRANSIT_HUB_METRO",
    "INDUSTRIAL_AREA",
]

CHANNELS = ["UPI", "IMPS", "NEFT"]


# ==============================================================================
# 1. GENERATE ATMS (150 RECORDS)
# ==============================================================================
def generate_atms(n_atms: int = 150) -> pd.DataFrame:
    """
    Generates 150 ATM locations strategically distributed across the 13 cities,
    with higher density in cybercrime cash-out hubs (4 North + 5 South hubs).
    """
    print(f"[1/5] Generating {n_atms} ATM records across {len(ALL_CITIES)} Indian cities...")

    city_allocation = {
        # North Syndicate Hubs (4)
        "Gurugram": 15,
        "Noida": 15,
        "Jamtara": 12,
        "Mewat": 12,
        # South Syndicate Hubs (5)
        "Bengaluru": 16,
        "Hyderabad": 15,
        "Chennai": 14,
        "Kolar": 10,
        "Nellore": 10,
        # Non-Hub Metros & Cities (4)
        "Mumbai": 14,
        "Kolkata": 10,
        "Coimbatore": 4,
        "Kochi": 3,
    }

    atms = []
    atm_counter = 1

    for city, count in city_allocation.items():
        cfg = CITY_CONFIG[city]
        for _ in range(count):
            lat_jitter = np.random.normal(0, cfg["radius"] / 2.5)
            lon_jitter = np.random.normal(0, cfg["radius"] / 2.5)

            lat = round(cfg["lat"] + lat_jitter, 6)
            lon = round(cfg["lon"] + lon_jitter, 6)

            atms.append({
                "atm_id": f"ATM_{atm_counter:03d}",
                "bank": random.choice(BANKS),
                "city": city,
                "lat": lat,
                "long": lon,
                "area_type": random.choice(AREA_TYPES),
            })
            atm_counter += 1

    return pd.DataFrame(atms)


# ==============================================================================
# 2. GENERATE ACCOUNTS (1,700 RECORDS: 200 MULES + 1000 LEGIT + 500 VICTIMS)
# ==============================================================================
def generate_accounts(
    n_mules: int = 200,
    n_legit: int = 1000,
    n_victims: int = 500
) -> pd.DataFrame:
    """
    Generates accounts with distinct risk distributions:
    - Mules: 50/50 split between North hubs and South hubs, clustered devices & syndicates.
    - Legit: 365-3000 days old, high KYC score (0.85-1.0), normal/high income, distributed across all 13 cities.
    - Victims: Established accounts (365-2500 days), high KYC score (0.85-1.0), distributed across all 13 cities.
    """
    print(f"[2/5] Generating {n_mules + n_legit + n_victims} accounts ({n_mules} Mules, {n_legit} Legit, {n_victims} Victims)...")

    accounts = []
    num_mule_syndicates = 35
    syndicate_ids = [f"SYN_{i:03d}" for i in range(1, num_mule_syndicates + 1)]
    mule_device_ids = [f"DEV_MULE_{i:03d}" for i in range(1, num_mule_syndicates + 1)]

    for i in range(1, n_mules + 1):
        acc_id = f"M{i:05d}"
        syn_idx = (i - 1) % num_mule_syndicates
        assigned_syndicate = syndicate_ids[syn_idx]
        assigned_device = mule_device_ids[syn_idx]

        # 50/50 split between North hubs (100 mules) and South hubs (100 mules)
        if i <= n_mules // 2:
            assigned_city = NORTH_HUB_CITIES[(i - 1) % len(NORTH_HUB_CITIES)]
        else:
            assigned_city = SOUTH_HUB_CITIES[(i - 1) % len(SOUTH_HUB_CITIES)]

        accounts.append({
            "account_id": acc_id,
            "account_type": np.random.choice(["SAVINGS", "CURRENT"], p=[0.85, 0.15]),
            "account_age_days": int(np.random.randint(1, 91)),
            "kyc_match_score": round(float(np.random.uniform(0.30, 0.70)), 2),
            "device_id": assigned_device,
            "avg_monthly_income": int(np.random.uniform(8000, 24000)),
            "risk_label": 1,
            "city": assigned_city,
            "syndicate_id": assigned_syndicate,
        })

    legit_device_pool = [f"DEV_LEGIT_{i:04d}" for i in range(1, 951)]

    for i in range(1, n_legit + 1):
        acc_id = f"L{i:05d}"
        assigned_device = np.random.choice(legit_device_pool)
        assigned_city = random.choice(ALL_CITIES)

        accounts.append({
            "account_id": acc_id,
            "account_type": np.random.choice(["SAVINGS", "CURRENT"], p=[0.75, 0.25]),
            "account_age_days": int(np.random.randint(365, 3001)),
            "kyc_match_score": round(float(np.random.uniform(0.85, 1.00)), 2),
            "device_id": assigned_device,
            "avg_monthly_income": int(np.random.uniform(35000, 220000)),
            "risk_label": 0,
            "city": assigned_city,
            "syndicate_id": "",
        })

    for i in range(1, n_victims + 1):
        acc_id = f"VACC_{i:04d}"
        assigned_device = f"DEV_VIC_{i:04d}"
        assigned_city = random.choice(ALL_CITIES)

        accounts.append({
            "account_id": acc_id,
            "account_type": "SAVINGS",
            "account_age_days": int(np.random.randint(365, 2501)),
            "kyc_match_score": round(float(np.random.uniform(0.88, 1.00)), 2),
            "device_id": assigned_device,
            "avg_monthly_income": int(np.random.uniform(30000, 180000)),
            "risk_label": 0,
            "city": assigned_city,
            "syndicate_id": "",
        })

    return pd.DataFrame(accounts)


# ==============================================================================
# 3. GENERATE VICTIMS, TRANSACTIONS & WITHDRAWALS (COHERENT RELATIONAL GRAPH)
# ==============================================================================
def generate_victims_transactions_withdrawals(
    df_accounts: pd.DataFrame,
    df_atms: pd.DataFrame,
    n_victims: int = 500,
    n_total_fraud_txns: int = 3500,
    n_legit_txns: int = 1500,
):
    """
    Builds victims, transactions, and withdrawals synchronously:
    - 500 victims targeted by 35 syndicates (realistic ring targeting)
    - 2,800 Victim -> Mule transactions
    - 700 Intra-Syndicate Mule -> Mule layering transactions (creates dense ring topology)
    - 1,500 Legit transactions
    - Total = 5,000 transactions (3,500 fraud, 1,500 legit)
    - Withdrawals at ATMs (70% Syndicate Hub, 30% Victim City)
    """
    print(f"[3/5] Generating {n_victims} victims, {n_total_fraud_txns + n_legit_txns} transactions, and target withdrawals...")

    atms_by_city = {city: df_atms[df_atms["city"] == city].to_dict("records") for city in ALL_CITIES}
    syndicate_atms = df_atms[df_atms["city"].isin(SYNDICATE_HUB_CITIES)].to_dict("records")

    # Map syndicates to their mule member accounts
    mule_df = df_accounts[df_accounts["risk_label"] == 1]
    syndicate_groups = {}
    for syn_id, grp in mule_df.groupby("syndicate_id"):
        syndicate_groups[syn_id] = grp["account_id"].tolist()
    all_syndicate_ids = list(syndicate_groups.keys())

    legit_account_ids = df_accounts[df_accounts["account_id"].str.startswith("L")]["account_id"].tolist()

    base_start_time = datetime(2026, 6, 1, 8, 0, 0)

    # 2,800 victim->mule txns + 700 mule->mule layering txns = 3,500 total fraud txns
    n_victim_fraud_txns = 2800
    n_layering_txns = n_total_fraud_txns - n_victim_fraud_txns

    # Assign victims to syndicates: some syndicates target few victims, creating high purity communities
    # First 6 syndicates target only 1-3 victims each (yielding pure syndicate rings)
    victim_to_syndicate = {}
    v_idx = 1
    # Distribute 500 victims across 35 syndicates
    syn_weights = np.random.dirichlet(np.ones(len(all_syndicate_ids)) * 1.5)
    v_counts = np.random.multinomial(n_victims - 12, syn_weights)
    # Ensure first 4 syndicates have low victim counts (1, 2, 2, 3)
    preset_counts = [1, 2, 2, 3] + list(v_counts)

    for syn_id, count in zip(all_syndicate_ids, preset_counts):
        for _ in range(count):
            if v_idx <= n_victims:
                victim_to_syndicate[f"VIC_{v_idx:04d}"] = syn_id
                v_idx += 1
    # Fill remaining if any
    while v_idx <= n_victims:
        victim_to_syndicate[f"VIC_{v_idx:04d}"] = random.choice(all_syndicate_ids)
        v_idx += 1

    # Distribute 2,800 victim fraud transactions across 500 victims
    txn_weights = np.random.dirichlet(np.ones(n_victims) * 2.5)
    txns_per_victim = np.random.multinomial(n_victim_fraud_txns, txn_weights)
    for idx in range(n_victims):
        if txns_per_victim[idx] == 0:
            txns_per_victim[idx] = 1
    diff = sum(txns_per_victim) - n_victim_fraud_txns
    while diff > 0:
        max_idx = np.argmax(txns_per_victim)
        if txns_per_victim[max_idx] > 1:
            txns_per_victim[max_idx] -= 1
            diff -= 1
        else:
            break

    victims = []
    transactions = []
    withdrawals = []

    txn_global_id = 1
    withdrawal_global_id = 1

    # Store mule transaction timestamps for coherent layering
    mule_inflow_events = {}

    for v_idx in range(1, n_victims + 1):
        victim_id = f"VIC_{v_idx:04d}"
        victim_account_id = f"VACC_{v_idx:04d}"
        target_syndicate = victim_to_syndicate[victim_id]
        syn_mules = syndicate_groups[target_syndicate]

        victim_name = fake.name()
        victim_city = random.choice(ALL_CITIES)
        v_cfg = CITY_CONFIG[victim_city]
        v_lat = round(v_cfg["lat"] + np.random.normal(0, v_cfg["radius"] / 3.0), 6)
        v_lon = round(v_cfg["lon"] + np.random.normal(0, v_cfg["radius"] / 3.0), 6)
        fraud_type = random.choice(FRAUD_TYPES)

        victim_start_time = base_start_time + timedelta(
            days=int(np.random.randint(0, 50)),
            hours=int(np.random.randint(6, 22)),
            minutes=int(np.random.randint(0, 60)),
        )

        v_txns_count = txns_per_victim[v_idx - 1]
        victim_total_lost = 0
        last_txn_time = victim_start_time
        current_time = victim_start_time

        for _ in range(v_txns_count):
            current_time = current_time + timedelta(minutes=int(np.random.randint(5, 180)))
            last_txn_time = current_time

            raw_amount = int(np.random.choice([10000, 15000, 20000, 25000, 40000, 50000, 75000, 95000, 100000]))
            amount = raw_amount + int(np.random.choice([0, 500, 999, 1000]))
            victim_total_lost += amount

            # Pay a mule belonging to the targeting syndicate
            assigned_mule = random.choice(syn_mules)
            channel = np.random.choice(CHANNELS, p=[0.70, 0.22, 0.08])
            txn_id = f"TXN_{txn_global_id:05d}"

            transactions.append({
                "txn_id": txn_id,
                "sender_id": victim_account_id,
                "receiver_id": assigned_mule,
                "amount": amount,
                "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                "channel": channel,
                "is_fraud": 1,
                "victim_id": victim_id,
                "txn_hour": current_time.hour,
            })
            txn_global_id += 1

            mule_inflow_events.setdefault(assigned_mule, []).append((current_time, amount, target_syndicate))

            # ATM Withdrawals
            is_syndicate = np.random.rand() < 0.70
            cashout_pattern = "SYNDICATE_HUB" if is_syndicate else "VICTIM_CITY"

            if is_syndicate:
                selected_atm = random.choice(syndicate_atms)
            else:
                city_atms = atms_by_city.get(victim_city, syndicate_atms)
                selected_atm = random.choice(city_atms)

            withdrawal_base_time = current_time + timedelta(minutes=int(np.random.randint(5, 91)))
            payout_ratio = np.random.uniform(0.80, 1.00)
            total_cash_out = int(amount * payout_ratio)

            if total_cash_out <= 15000:
                num_wth = 1
            elif total_cash_out <= 30000:
                num_wth = np.random.choice([1, 2], p=[0.3, 0.7])
            else:
                num_wth = np.random.choice([2, 3], p=[0.4, 0.6])

            proportions = np.random.dirichlet(np.ones(num_wth))
            raw_w_amounts = proportions * total_cash_out
            w_amounts = [max(500, int(round(a / 500.0) * 500)) for a in raw_w_amounts]
            w_amounts = [min(15000, max(1000, val)) for val in w_amounts]

            for w_idx, w_amt in enumerate(w_amounts):
                w_time = withdrawal_base_time + timedelta(minutes=w_idx * int(np.random.randint(3, 13)))
                withdrawals.append({
                    "withdrawal_id": f"WTH_{withdrawal_global_id:05d}",
                    "txn_id": txn_id,
                    "atm_id": selected_atm["atm_id"],
                    "lat": selected_atm["lat"],
                    "long": selected_atm["long"],
                    "amount_withdrawn": w_amt,
                    "withdrawal_timestamp": w_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "cashout_pattern": cashout_pattern,
                    "withdrawal_hour": w_time.hour,
                })
                withdrawal_global_id += 1

        complaint_delay_hours = int(np.random.randint(2, 120))
        complaint_time = last_txn_time + timedelta(hours=complaint_delay_hours)

        victims.append({
            "victim_id": victim_id,
            "victim_account_id": victim_account_id,
            "name": victim_name,
            "city": victim_city,
            "lat": v_lat,
            "long": v_lon,
            "fraud_type": fraud_type,
            "amount_lost": victim_total_lost,
            "complaint_timestamp": complaint_time.strftime("%Y-%m-%d %H:%M:%S"),
        })

    # --------------------------------------------------------------------------
    # B. Generate 700 Intra-Syndicate Mule Layering Transactions (Mule -> Mule)
    # --------------------------------------------------------------------------
    # Creates dense intra-syndicate connectivity for ring detection & pass-through ratios
    for _ in range(n_layering_txns):
        syn_id = random.choice(all_syndicate_ids)
        syn_mules = syndicate_groups[syn_id]
        if len(syn_mules) < 2:
            continue

        sender_mule, receiver_mule = random.sample(syn_mules, 2)
        layer_amount = int(np.random.choice([15000, 25000, 35000, 50000, 60000]))
        layer_time = base_start_time + timedelta(
            days=int(np.random.randint(0, 55)),
            hours=int(np.random.randint(6, 23)),
            minutes=int(np.random.randint(0, 60)),
        )

        txn_id = f"TXN_{txn_global_id:05d}"
        channel = np.random.choice(["IMPS", "UPI", "NEFT"], p=[0.50, 0.40, 0.10])

        transactions.append({
            "txn_id": txn_id,
            "sender_id": sender_mule,
            "receiver_id": receiver_mule,
            "amount": layer_amount,
            "timestamp": layer_time.strftime("%Y-%m-%d %H:%M:%S"),
            "channel": channel,
            "is_fraud": 1,
            "victim_id": "",
            "txn_hour": layer_time.hour,
        })
        txn_global_id += 1

    # --------------------------------------------------------------------------
    # C. Generate 1,500 Legitimate Transactions (Lxxxxx -> Lyyyyy)
    # --------------------------------------------------------------------------
    for _ in range(n_legit_txns):
        sender_acc, receiver_acc = random.sample(legit_account_ids, 2)
        legit_amount = int(np.random.choice([
            int(np.random.uniform(200, 2500)),
            int(np.random.uniform(2500, 15000)),
            int(np.random.uniform(15000, 45000))
        ], p=[0.60, 0.30, 0.10]))

        legit_time = base_start_time + timedelta(
            days=int(np.random.randint(0, 60)),
            hours=int(np.random.randint(7, 23)),
            minutes=int(np.random.randint(0, 60)),
            seconds=int(np.random.randint(0, 60)),
        )

        channel = np.random.choice(CHANNELS, p=[0.65, 0.25, 0.10])
        txn_id = f"TXN_{txn_global_id:05d}"

        transactions.append({
            "txn_id": txn_id,
            "sender_id": sender_acc,
            "receiver_id": receiver_acc,
            "amount": legit_amount,
            "timestamp": legit_time.strftime("%Y-%m-%d %H:%M:%S"),
            "channel": channel,
            "is_fraud": 0,
            "victim_id": "",
            "txn_hour": legit_time.hour,
        })
        txn_global_id += 1

    df_victims = pd.DataFrame(victims)
    df_transactions = pd.DataFrame(transactions)
    df_withdrawals = pd.DataFrame(withdrawals)

    df_transactions = df_transactions.sort_values(by="timestamp").reset_index(drop=True)
    df_withdrawals = df_withdrawals.sort_values(by="withdrawal_timestamp").reset_index(drop=True)

    return df_victims, df_transactions, df_withdrawals


# ==============================================================================
# 4. MAIN EXECUTION & VERIFICATION PIPELINE
# ==============================================================================
def main():
    print("=" * 80)
    print(f" MuleShield (SIH26184) Data Generator | Deterministic Seed = {SEED}")
    print("=" * 80)
    print(f"[INFO] Output Directory: {OUTPUT_DIR}")

    df_atms = generate_atms(n_atms=150)
    df_accounts = generate_accounts(n_mules=200, n_legit=1000, n_victims=500)
    df_victims, df_transactions, df_withdrawals = generate_victims_transactions_withdrawals(
        df_accounts=df_accounts,
        df_atms=df_atms,
        n_victims=500,
        n_total_fraud_txns=3500,
        n_legit_txns=1500,
    )

    print("\n[4/5] Writing CSV files to disk...")
    files_to_save = [
        ("victims.csv", df_victims),
        ("accounts.csv", df_accounts),
        ("transactions.csv", df_transactions),
        ("atms.csv", df_atms),
        ("withdrawals.csv", df_withdrawals),
    ]

    for filename, df in files_to_save:
        filepath = OUTPUT_DIR / filename
        df.to_csv(filepath, index=False)
        print(f"  -> Saved {filename:<18} ({len(df):>6} rows, {len(df.columns):>2} cols) -> {filepath}")

    print("\n[5/5] Performing Relational and Statistical Verification:")
    print("-" * 80)
    print(f"  * Total Victims:              {len(df_victims)} (Expected: 500)")
    print(f"  * Total Accounts:             {len(df_accounts)} (Mules: {(df_accounts['risk_label'] == 1).sum()}, Legit: {(df_accounts['risk_label'] == 0).sum()})")
    print(f"  * Total Transactions:         {len(df_transactions)} (Fraud: {(df_transactions['is_fraud'] == 1).sum()}, Legit: {(df_transactions['is_fraud'] == 0).sum()})")
    print(f"  * Total ATMs:                 {len(df_atms)} (Expected: 150 across 13 cities)")
    print(f"  * Total Withdrawals:          {len(df_withdrawals)} (Target events)")

    cashout_dist = df_withdrawals["cashout_pattern"].value_counts(normalize=True).to_dict()
    syndicate_pct = cashout_dist.get("SYNDICATE_HUB", 0) * 100
    victim_pct = cashout_dist.get("VICTIM_CITY", 0) * 100
    print(f"  * Cashout Pattern Split:      SYNDICATE_HUB = {syndicate_pct:.1f}%, VICTIM_CITY = {victim_pct:.1f}%")

    all_account_ids = set(df_accounts["account_id"])
    senders_valid = df_transactions["sender_id"].isin(all_account_ids).all()
    receivers_valid = df_transactions["receiver_id"].isin(all_account_ids).all()
    print(f"  * Graph Integrity:            Senders valid in accounts: {senders_valid} | Receivers valid in accounts: {receivers_valid}")

    mule_accs = df_accounts[df_accounts["risk_label"] == 1]
    unique_mule_devices = mule_accs["device_id"].nunique()
    print(f"  * Mule Device Clustering:     200 mules share {unique_mule_devices} unique device IDs")
    print("=" * 80)
    print("[SUCCESS] Module A synthetic data generation complete. Ready for Module B & C.")
    print("=" * 80)


if __name__ == "__main__":
    main()
