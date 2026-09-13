"""
==============================================================================
MuleShield (SIH26184) - Module B: Mule Account Detection Engine
==============================================================================
Trains and evaluates 4 high-performance gradient boosting models:
- CatBoost Classifier (iterations=500, depth=6, lr=0.05)
- XGBoost Classifier (n_estimators=500, max_depth=6, lr=0.05)
- LightGBM Classifier (n_estimators=500, max_depth=6, lr=0.05)
- Soft-Voting Ensemble (CatBoost + XGBoost + LightGBM)

Pipeline Stages:
1. Load accounts.csv and transactions.csv from backend/data/
2. Compute 15 behavioral & topological graph features per account
3. Stratified Train/Test split (80/20, random_state=42)
4. Train all 4 models and compute AUC-ROC, Precision, Recall, and F1
5. Prioritize Recall to select the best production model
6. Run SHAP TreeExplainer on CatBoost for interpretability
7. Save best model (.pkl), metadata (.json), features (.csv), and SHAP importance (.csv)
8. Print clean performance summary table
==============================================================================
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap
from catboost import CatBoostClassifier
from lightgbm import LGBMClassifier
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

# ==============================================================================
# PATH CONFIGURATION
# ==============================================================================
MODELS_DIR = Path(__file__).resolve().parent
BASE_DIR = MODELS_DIR.parent
DATA_DIR = BASE_DIR / "data"

MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# List of 18 engineered behavioral and syndicate features (Module B Blueprint Completion)
FEATURE_COLS = [
    "txn_count",
    "velocity_per_hour",
    "total_sent",
    "total_received",
    "pass_through_ratio",
    "io_ratio",
    "unique_senders",
    "unique_receivers",
    "avg_txn_amount",
    "max_txn_amount",
    "income_mismatch",
    "account_age_days",
    "kyc_match_score",
    "device_shared_count",
    "is_in_syndicate",
    "dormancy_burst_score",
    "beneficiary_churn_rate",
    "structuring_score",
]


# ==============================================================================
# SOFT-VOTING ENSEMBLE CLASSIFIER
# ==============================================================================
class SoftVotingEnsemble(BaseEstimator, ClassifierMixin):
    """
    Production-ready Soft-Voting Ensemble combining CatBoost, XGBoost, and LightGBM.
    Averages predicted probabilities for stable, low-variance risk scoring.
    """

    def __init__(self, models=None):
        self.models = models or []

    def fit(self, X, y):
        for name, model in self.models:
            model.fit(X, y)
        self.classes_ = np.unique(y)
        return self

    def predict_proba(self, X):
        probas = [model.predict_proba(X) for _, model in self.models]
        return np.mean(probas, axis=0)

    def predict(self, X):
        avg_proba = self.predict_proba(X)
        return (avg_proba[:, 1] >= 0.5).astype(int)


# ==============================================================================
# 1. DATA LOADING
# ==============================================================================
def load_data():
    """Loads accounts.csv and transactions.csv from backend/data/."""
    print("[1/7] Loading datasets from disk...")
    accounts_path = DATA_DIR / "accounts.csv"
    transactions_path = DATA_DIR / "transactions.csv"

    if not accounts_path.exists() or not transactions_path.exists():
        raise FileNotFoundError(
            f"Missing required CSV files in {DATA_DIR}. Please run backend/data/generate_data.py first."
        )

    df_accounts = pd.read_csv(accounts_path)
    df_transactions = pd.read_csv(transactions_path)

    print(f"  -> accounts.csv:     {len(df_accounts):>6} rows, {len(df_accounts.columns)} columns")
    print(f"  -> transactions.csv: {len(df_transactions):>6} rows, {len(df_transactions.columns)} columns")
    return df_accounts, df_transactions


# ==============================================================================
# 2. FEATURE ENGINEERING
# ==============================================================================
def engineer_features(df_accounts: pd.DataFrame, df_transactions: pd.DataFrame) -> pd.DataFrame:
    """
    Computes 15 behavioral, financial, and network features per account.
    Fully handles division-by-zero, unobserved accounts, and edge cases.
    """
    print("[2/7] Engineering behavioral and topological features per account...")

    # A. Aggregations where account is SENDER
    sent_agg = df_transactions.groupby("sender_id").agg(
        total_sent=("amount", "sum"),
        sent_count=("amount", "count"),
        unique_receivers=("receiver_id", "nunique"),
        max_sent=("amount", "max"),
    ).reset_index().rename(columns={"sender_id": "account_id"})

    # B. Aggregations where account is RECEIVER
    recv_agg = df_transactions.groupby("receiver_id").agg(
        total_received=("amount", "sum"),
        recv_count=("amount", "count"),
        unique_senders=("sender_id", "nunique"),
        max_recv=("amount", "max"),
    ).reset_index().rename(columns={"receiver_id": "account_id"})

    # C. Unified Transaction Statistics (Sender + Receiver combined)
    sender_stream = df_transactions[["sender_id", "amount"]].rename(columns={"sender_id": "account_id"})
    receiver_stream = df_transactions[["receiver_id", "amount"]].rename(columns={"receiver_id": "account_id"})
    all_account_stream = pd.concat([sender_stream, receiver_stream], ignore_index=True)

    stream_agg = all_account_stream.groupby("account_id").agg(
        txn_count=("amount", "count"),
        avg_txn_amount=("amount", "mean"),
        max_txn_amount=("amount", "max"),
    ).reset_index()

    # D. Merge with df_accounts
    merged = df_accounts.copy()
    merged = merged.merge(sent_agg, on="account_id", how="left")
    merged = merged.merge(recv_agg, on="account_id", how="left")
    merged = merged.merge(stream_agg, on="account_id", how="left")

    # E. Impute Missing Values for accounts with zero transactions
    merged["total_sent"] = merged["total_sent"].fillna(0.0)
    merged["total_received"] = merged["total_received"].fillna(0.0)
    merged["sent_count"] = merged["sent_count"].fillna(0).astype(int)
    merged["recv_count"] = merged["recv_count"].fillna(0).astype(int)
    merged["unique_receivers"] = merged["unique_receivers"].fillna(0).astype(int)
    merged["unique_senders"] = merged["unique_senders"].fillna(0).astype(int)
    merged["txn_count"] = merged["txn_count"].fillna(0).astype(int)
    merged["avg_txn_amount"] = merged["avg_txn_amount"].fillna(0.0)
    merged["max_txn_amount"] = merged["max_txn_amount"].fillna(0.0)

    # F. Compute Derived Behavioral Ratios
    # Velocity per hour (normalizing transaction activity)
    merged["velocity_per_hour"] = merged["txn_count"] / 24.0

    # Conduit pass-through ratio: total_sent / total_received (handling zero-division)
    merged["pass_through_ratio"] = np.where(
        merged["total_received"] > 0,
        merged["total_sent"] / merged["total_received"],
        0.0,
    )

    # Inflow/Outflow ratio: total_received / total_sent (handling zero-division)
    merged["io_ratio"] = np.where(
        merged["total_sent"] > 0,
        merged["total_received"] / merged["total_sent"],
        0.0,
    )

    # Income mismatch: inflow vs declared economic profile
    merged["income_mismatch"] = merged["total_received"] / (
        merged["avg_monthly_income"].astype(float) + 1.0
    )

    # Network Syndicate Signals
    device_counts = merged["device_id"].value_counts()
    merged["device_shared_count"] = (
        merged["device_id"].map(device_counts).fillna(1).astype(int)
    )

    merged["is_in_syndicate"] = (
        merged["syndicate_id"].fillna("").astype(str).str.strip().ne("").astype(int)
    )

    # Convert numeric fields
    merged["account_age_days"] = merged["account_age_days"].astype(float)
    merged["kyc_match_score"] = merged["kyc_match_score"].astype(float)

    # G. Blueprint Completion Features (Module B - 3 New Behavioral Features)
    # Feature 1: Dormancy-Burst Detector
    # dormancy_burst_score = (recent_txn_count last 7 days) / max(historical_txn_count before last 7 days, 1)
    df_tx_dt = pd.to_datetime(df_transactions["timestamp"])
    max_ts = df_tx_dt.max()
    cutoff_7d = max_ts - pd.Timedelta(days=7)

    tx_with_ts = df_transactions.assign(ts_dt=df_tx_dt)
    stream_sender_ts = tx_with_ts[["sender_id", "amount", "ts_dt"]].rename(columns={"sender_id": "account_id"})
    stream_recv_ts = tx_with_ts[["receiver_id", "amount", "ts_dt"]].rename(columns={"receiver_id": "account_id"})
    stream_ts = pd.concat([stream_sender_ts, stream_recv_ts], ignore_index=True)

    recent_mask = stream_ts["ts_dt"] >= cutoff_7d
    recent_cnt = stream_ts[recent_mask].groupby("account_id")["amount"].count().rename("recent_txn_count")
    hist_cnt = stream_ts[~recent_mask].groupby("account_id")["amount"].count().rename("hist_txn_count")

    merged = merged.merge(recent_cnt, on="account_id", how="left")
    merged = merged.merge(hist_cnt, on="account_id", how="left")
    merged["recent_txn_count"] = merged["recent_txn_count"].fillna(0).astype(int)
    merged["hist_txn_count"] = merged["hist_txn_count"].fillna(0).astype(int)
    merged["dormancy_burst_score"] = merged["recent_txn_count"] / np.maximum(merged["hist_txn_count"], 1.0)

    # Feature 2: Beneficiary Churn Analyser
    # beneficiary_churn_rate = (unique_receivers last 7 days) / max(unique_receivers total, 1)
    recent_txns = tx_with_ts[tx_with_ts["ts_dt"] >= cutoff_7d]
    rec_receivers = recent_txns.groupby("sender_id")["receiver_id"].nunique().rename("unique_receivers_7d").reset_index().rename(columns={"sender_id": "account_id"})
    merged = merged.merge(rec_receivers, on="account_id", how="left")
    merged["unique_receivers_7d"] = merged["unique_receivers_7d"].fillna(0).astype(int)
    merged["beneficiary_churn_rate"] = merged["unique_receivers_7d"] / np.maximum(merged["unique_receivers"], 1.0)

    # Feature 3: Structuring Detector
    # structuring_score = count(txns ₹9,500-₹9,999 OR ₹49,500-₹49,999) / total_txns
    is_structuring = (
        ((stream_ts["amount"] >= 9500) & (stream_ts["amount"] <= 9999)) |
        ((stream_ts["amount"] >= 49500) & (stream_ts["amount"] <= 49999))
    )
    struct_cnt = stream_ts[is_structuring].groupby("account_id")["amount"].count().rename("structuring_count")
    merged = merged.merge(struct_cnt, on="account_id", how="left")
    merged["structuring_count"] = merged["structuring_count"].fillna(0).astype(int)
    merged["structuring_score"] = merged["structuring_count"] / np.maximum(merged["txn_count"], 1.0)

    # Save engineered feature dataframe (18 features total)
    feature_csv_path = DATA_DIR / "account_features.csv"
    output_cols = ["account_id", "risk_label"] + FEATURE_COLS
    merged[output_cols].to_csv(feature_csv_path, index=False)
    print(f"  -> Saved account_features.csv ({len(merged)} records, {len(FEATURE_COLS)} features) -> {feature_csv_path}")

    return merged


# ==============================================================================
# 3. MODEL TRAINING & EVALUATION
# ==============================================================================
def train_and_evaluate(df_features: pd.DataFrame):
    """
    Splits dataset into 80/20 stratified train/test sets,
    trains CatBoost, XGBoost, LightGBM, and SoftVotingEnsemble,
    and returns models, metrics, and test datasets.
    """
    print("[3/7] Partitioning data (80/20 Stratified Split)...")
    X = df_features[FEATURE_COLS]
    y = df_features["risk_label"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    n_mules_train = (y_train == 1).sum()
    n_mules_test = (y_test == 1).sum()
    print(f"  -> Train samples: {len(X_train)} (Mules: {n_mules_train}, Legit: {len(X_train) - n_mules_train})")
    print(f"  -> Test samples:  {len(X_test)} (Mules: {n_mules_test}, Legit: {len(X_test) - n_mules_test})")

    print("\n[4/7] Training 4 Gradient Boosting Models...")

    # 1. CatBoost
    print("  [1/4] Training CatBoost Classifier (iterations=500, depth=6, lr=0.05)...")
    cb_model = CatBoostClassifier(
        iterations=500,
        depth=6,
        learning_rate=0.05,
        random_seed=42,
        verbose=False,
        eval_metric="AUC",
    )
    cb_model.fit(X_train, y_train)

    # 2. XGBoost
    print("  [2/4] Training XGBoost Classifier (n_estimators=500, max_depth=6, lr=0.05)...")
    xgb_model = XGBClassifier(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        random_state=42,
        eval_metric="logloss",
    )
    xgb_model.fit(X_train, y_train)

    # 3. LightGBM
    print("  [3/4] Training LightGBM Classifier (n_estimators=500, max_depth=6, lr=0.05)...")
    lgb_model = LGBMClassifier(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        random_state=42,
        verbosity=-1,
    )
    lgb_model.fit(X_train, y_train)

    # 4. Soft-Voting Ensemble
    print("  [4/4] Assembling Soft-Voting Ensemble (CatBoost + XGBoost + LightGBM)...")
    ensemble_model = SoftVotingEnsemble(
        models=[
            ("catboost", cb_model),
            ("xgboost", xgb_model),
            ("lightgbm", lgb_model),
        ]
    )
    ensemble_model.classes_ = np.array([0, 1])

    models = {
        "CatBoost": cb_model,
        "XGBoost": xgb_model,
        "LightGBM": lgb_model,
        "Ensemble": ensemble_model,
    }

    # Evaluate all models
    metrics = {}
    for name, model in models.items():
        y_proba = model.predict_proba(X_test)[:, 1]
        y_pred = (y_proba >= 0.5).astype(int)

        auc = roc_auc_score(y_test, y_proba)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)

        metrics[name] = {
            "auc": float(round(auc, 4)),
            "precision": float(round(prec, 4)),
            "recall": float(round(rec, 4)),
            "f1": float(round(f1, 4)),
        }

    return models, metrics, X_train, X_test, y_train, y_test


# ==============================================================================
# 4. SHAP EXPLAINABILITY
# ==============================================================================
def explain_with_shap(cb_model: CatBoostClassifier, X_test: pd.DataFrame):
    """
    Computes SHAP TreeExplainer feature importance values for the CatBoost model,
    saves the global importances to CSV, and prints the top 10 features.
    """
    print("\n[5/7] Computing SHAP explainability values via TreeExplainer...")
    explainer = shap.TreeExplainer(cb_model)
    shap_values = explainer.shap_values(X_test)

    # Handle shape differences across SHAP versions
    if isinstance(shap_values, list):
        shap_matrix = shap_values[1]
    elif len(np.shape(shap_values)) == 3:
        shap_matrix = shap_values[:, :, 1]
    else:
        shap_matrix = shap_values

    # Mean absolute SHAP value per feature
    mean_abs_shap = np.abs(shap_matrix).mean(axis=0)
    df_shap = pd.DataFrame({
        "feature": FEATURE_COLS,
        "mean_abs_shap": mean_abs_shap,
    }).sort_values(by="mean_abs_shap", ascending=False).reset_index(drop=True)

    shap_csv_path = MODELS_DIR / "shap_feature_importance.csv"
    df_shap.to_csv(shap_csv_path, index=False)
    print(f"  -> Saved SHAP feature importances -> {shap_csv_path}")

    print("\n  Top 10 Most Important Features (SHAP Global Impact):")
    print("  " + "-" * 50)
    for idx, row in df_shap.head(10).iterrows():
        print(f"   {idx + 1:>2}. {row['feature']:<22} | SHAP: {row['mean_abs_shap']:.4f}")
    print("  " + "-" * 50)

    return df_shap


# ==============================================================================
# 5. ARTIFACT PERSISTENCE
# ==============================================================================
def save_artifacts(best_name: str, best_model, best_metrics: dict, n_train: int, n_test: int):
    """
    Persists the best model as mule_detector.pkl and writes model_metadata.json.
    """
    print("\n[6/7] Persisting model artifacts to disk...")

    # Save model via joblib
    model_path = MODELS_DIR / "mule_detector.pkl"
    joblib.dump(best_model, model_path)
    print(f"  -> Best model ({best_name}) saved -> {model_path}")

    # Save model metadata
    metadata = {
        "model_name": best_name,
        "auc": best_metrics["auc"],
        "precision": best_metrics["precision"],
        "recall": best_metrics["recall"],
        "f1": best_metrics["f1"],
        "training_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "feature_list": FEATURE_COLS,
        "n_train": n_train,
        "n_test": n_test,
    }

    metadata_path = MODELS_DIR / "model_metadata.json"
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)
    print(f"  -> Model metadata saved -> {metadata_path}")


# ==============================================================================
# 6. PRINT CLEAN SUMMARY
# ==============================================================================
def print_summary_table(metrics: dict, best_name: str):
    """Prints the final formatted evaluation table."""
    print("\n[7/7] Evaluation Summary:")
    print("=" * 44)
    print("MODEL      | AUC    | PREC   | RECALL | F1    ")
    print("=" * 44)
    for model_name in ["CatBoost", "XGBoost", "LightGBM", "Ensemble"]:
        m = metrics[model_name]
        print(f"{model_name:<10} | {m['auc']:.4f} | {m['precision']:.4f} | {m['recall']:.4f} | {m['f1']:.4f}")
    print("=" * 44)
    print(f"Best model saved: {best_name}\n")


# ==============================================================================
# MAIN ENTRY POINT
# ==============================================================================
def main():
    print("=" * 80)
    print(" MuleShield (SIH26184) - Module B: Mule Detection Training Engine")
    print("=" * 80)

    # 1. Load Data
    df_accounts, df_transactions = load_data()

    # 2. Engineer Behavioral Features
    df_features = engineer_features(df_accounts, df_transactions)

    # 3. Train & Evaluate Models
    models, metrics, X_train, X_test, y_train, y_test = train_and_evaluate(df_features)

    # 4. Select Best Model (Prioritizing Recall, then F1, then AUC)
    best_name = max(
        metrics.keys(),
        key=lambda m: (metrics[m]["recall"], metrics[m]["f1"], metrics[m]["auc"]),
    )
    best_model = models[best_name]
    best_metrics = metrics[best_name]

    # 5. SHAP Explainability on CatBoost
    explain_with_shap(models["CatBoost"], X_test)

    # 6. Save Artifacts
    save_artifacts(
        best_name=best_name,
        best_model=best_model,
        best_metrics=best_metrics,
        n_train=len(X_train),
        n_test=len(X_test),
    )

    # 7. Print Final Formatted Table
    print_summary_table(metrics, best_name)


if __name__ == "__main__":
    main()
