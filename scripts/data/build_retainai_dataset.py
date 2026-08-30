import argparse
import csv
import json
import random
import uuid
import os
from datetime import datetime, timedelta, timezone
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def load_public_tickets():
    path = "data/raw/helpdesk_tickets.csv"
    if not os.path.exists(path):
        logging.warning("Public tickets not found. Run download_datasets.py first. Proceeding with basic defaults.")
        return []
        
    tickets = []
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tickets.append(row)
    return tickets

def generate_customer(cid, name, tier, mrr, csm, archetype):
    return {
        "id": cid,
        "name": name,
        "domain": f"{name.lower().replace(' ', '')}.com",
        "tier": tier,
        "mrr": mrr,
        "csm_name": csm,
        "archetype": archetype,
        "renewal_date": (datetime.now(timezone.utc) + timedelta(days=random.randint(30, 300))).isoformat(),
        "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(100, 700))).isoformat(),
        "metadata": {
            "source_type": "SYNTHETIC",
            "generation_version": "dataset-v2"
        }
    }

def get_ticket_details(public_tickets, default_subject, default_severity, default_category):
    if not public_tickets:
        return default_subject, default_severity, default_category, None
        
    t = random.choice(public_tickets)
    return t.get('subject', default_subject), t.get('priority', default_severity).upper(), t.get('category', default_category).upper(), t.get('id')

def build_portfolio(seed, num_customers):
    random.seed(seed)
    now = datetime.now(timezone.utc)
    public_tickets = load_public_tickets()
    
    customers = []
    usage_events = []
    support_tickets = []
    feedbacks = []
    
    # --- ACME DEMO SCENARIO (Hardcoded Hero) ---
    acme_id = str(uuid.uuid4())
    customers.append(generate_customer(acme_id, "Acme Corp", "Enterprise", 12000.0, "Sarah Johnson", "ACME_HERO"))
    
    for day_offset in range(30, -1, -1):
        event_date = now - timedelta(days=day_offset)
        # Usage
        if day_offset > 21:
            dau, util, clicks, admins = random.randint(180, 200), 0.90, random.randint(500, 600), random.randint(2, 5)
        elif day_offset > 7:
            dau, util, clicks, admins = random.randint(120, 150), 0.70, random.randint(300, 400), random.randint(0, 2)
        else:
            dau, util, clicks, admins = random.randint(40, 80), 0.40, random.randint(50, 150), 0

        usage_events.append({
            "id": str(uuid.uuid4()), "customer_id": acme_id, "timestamp": event_date.isoformat(),
            "dau": dau, "license_utilization_pct": util, "core_feature_clicks": clicks,
            "export_events": int(clicks * 0.1), "admin_logins": admins,
            "metadata": {"source_type": "SYNTHETIC"}
        })
        # Support
        if day_offset == 14:
            support_tickets.append({
                "id": str(uuid.uuid4()), "customer_id": acme_id, "created_at": event_date.isoformat(),
                "resolved_at": None, "severity": "HIGH", "category": "BUG",
                "subject": "Data export failing consistently", "status": "OPEN",
                "metadata": {"source_type": "SYNTHETIC"}
            })
        # Feedback
        if day_offset == 10:
            feedbacks.append({
                "id": str(uuid.uuid4()), "customer_id": acme_id, "timestamp": event_date.isoformat(),
                "channel": "NPS_SURVEY", "score": 3, "sentiment": "NEGATIVE",
                "feedback_text": "Frustrated with reporting bugs. The export hasn't worked for days.",
                "metadata": {"source_type": "SYNTHETIC"}
            })

    # --- 100+ CUSTOMER PORTFOLIO ---
    archetypes = ["HEALTHY"] * 60 + ["EARLY_WARNING"] * 20 + ["AT_RISK"] * 10 + ["CRITICAL"] * 5 + ["RECOVERING"] * 5
    
    for i in range(num_customers):
        cid = str(uuid.uuid4())
        archetype = random.choice(archetypes)
        customers.append(generate_customer(cid, f"Synthetic Company {i}", "Mid-Market", random.uniform(1000, 5000), "Auto CSM", archetype))
        
        base_dau = random.randint(50, 500)
        
        for day_offset in range(30, -1, -1):
            event_date = now - timedelta(days=day_offset)
            
            # Archetype behavior
            if archetype == "HEALTHY":
                dau_mod = random.uniform(0.9, 1.1)
                util = 0.85
                prob_ticket = 0.01
                prob_feedback = 0.02
                fb_score = random.randint(8, 10)
                
            elif archetype == "AT_RISK":
                dau_mod = 1.0 if day_offset > 15 else 0.6
                util = 0.50
                prob_ticket = 0.05
                prob_feedback = 0.05
                fb_score = random.randint(1, 4)
                
            elif archetype == "CRITICAL":
                dau_mod = 1.0 if day_offset > 20 else (0.3 if day_offset > 5 else 0.05)
                util = 0.20
                prob_ticket = 0.10
                prob_feedback = 0.05
                fb_score = random.randint(1, 2)
            else: # Defaults for Early Warning / Recovering
                dau_mod = 0.8
                util = 0.70
                prob_ticket = 0.03
                prob_feedback = 0.03
                fb_score = random.randint(5, 7)
                
            # Insert Usage
            usage_events.append({
                "id": str(uuid.uuid4()), "customer_id": cid, "timestamp": event_date.isoformat(),
                "dau": int(base_dau * dau_mod), "license_utilization_pct": util, 
                "core_feature_clicks": int(base_dau * dau_mod * 5), "admin_logins": random.randint(0, 2),
                "metadata": {"source_type": "SYNTHETIC"}
            })
            
            # Insert Support (blended with Public Data)
            if random.random() < prob_ticket:
                subj, sev, cat, src_id = get_ticket_details(public_tickets, "General Issue", "MEDIUM", "SOFTWARE")
                meta = {"source_type": "PUBLIC_DATASET", "source_dataset": "Console-AI/IT-helpdesk", "source_record_id": src_id} if src_id else {"source_type": "SYNTHETIC"}
                support_tickets.append({
                    "id": str(uuid.uuid4()), "customer_id": cid, "created_at": event_date.isoformat(),
                    "resolved_at": (event_date + timedelta(days=2)).isoformat() if archetype == "HEALTHY" else None,
                    "severity": sev, "category": cat, "subject": subj, 
                    "status": "RESOLVED" if archetype == "HEALTHY" else "OPEN",
                    "metadata": meta
                })

            # Insert Feedback
            if random.random() < prob_feedback:
                feedbacks.append({
                    "id": str(uuid.uuid4()), "customer_id": cid, "timestamp": event_date.isoformat(),
                    "channel": "NPS_SURVEY", "score": fb_score, 
                    "sentiment": "POSITIVE" if fb_score > 7 else ("NEGATIVE" if fb_score < 5 else "NEUTRAL"),
                    "feedback_text": "Synthetic feedback response.",
                    "metadata": {"source_type": "SYNTHETIC"}
                })

    dataset = {
        "metadata": {
            "version": "dataset-v2",
            "seed": seed,
            "generated_at": now.isoformat(),
            "customer_count": len(customers)
        },
        "customers": customers,
        "usage_events": usage_events,
        "support_tickets": support_tickets,
        "customer_feedbacks": feedbacks
    }
    
    os.makedirs('data/seed', exist_ok=True)
    with open('data/seed/retainai_dataset_v2.json', 'w') as f:
        json.dump(dataset, f, indent=2)
        
    logging.info(f"Generated hybrid dataset: {len(customers)} customers, {len(usage_events)} usage events, {len(support_tickets)} tickets.")
    logging.info("Saved to data/seed/retainai_dataset_v2.json")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--seed', type=int, default=42)
    parser.add_argument('--count', type=int, default=100)
    args = parser.parse_args()
    build_portfolio(args.seed, args.count)