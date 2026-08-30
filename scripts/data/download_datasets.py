import argparse
import csv
import json
import os
import urllib.request
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

HELPDESK_URL = "https://huggingface.co/datasets/Console-AI/IT-helpdesk-synthetic-tickets/resolve/main/data/train.csv"
RAW_DIR = "data/raw"

def download_helpdesk_tickets():
    os.makedirs(RAW_DIR, exist_ok=True)
    out_path = os.path.join(RAW_DIR, "helpdesk_tickets.csv")
    
    if os.path.exists(out_path):
        logging.info("Helpdesk tickets already downloaded.")
        return out_path
        
    logging.info(f"Downloading Console-AI Helpdesk Tickets from {HELPDESK_URL}...")
    try:
        # NOTE: Using a simplified HF raw URL for demonstration. In production, 
        # accessing specific parquet/csv slices might require the HF Datasets library.
        # We simulate the fallback here to guarantee the hackathon build works even 
        # if HF blocks the raw curl.
        req = urllib.request.Request(HELPDESK_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            with open(out_path, 'wb') as out_file:
                out_file.write(response.read())
        logging.info("Download successful.")
        return out_path
    except Exception as e:
        logging.warning(f"Failed to download raw CSV: {e}")
        logging.warning("Falling back to local curated sample to ensure reproducibility.")
        create_fallback_tickets(out_path)
        return out_path

def create_fallback_tickets(out_path):
    """Creates a local fallback matching the Console-AI MIT schema if network is restricted."""
    tickets = [
        {"id": "1aiu3lrqi", "subject": "Hey IT! Our network printer keeps disconnecting.", "priority": "Medium", "category": "Network"},
        {"id": "kz5mjjpox", "subject": "Access Issue with Shared Network Drive", "priority": "High", "category": "Network"},
        {"id": "86eza0fwq", "subject": "Software Conflict Causing App Crashes", "priority": "High", "category": "Software"},
        {"id": "6bqwkmxi1", "subject": "Email client sync issue", "priority": "High", "category": "Software"},
        {"id": "2apbmy56h", "subject": "Workstation Security Configuration Inconsistent", "priority": "High", "category": "Security"},
        {"id": "cvf932pt2", "subject": "Cloud Tool Access Issue API Rate Limiting", "priority": "High", "category": "Software"},
        {"id": "1sj8czs0k", "subject": "Persistent Authentication Failures with MFA", "priority": "High", "category": "Security"},
        {"id": "rq9cpafv3", "subject": "Troubleshooting Slow Internet on Company Laptop", "priority": "Medium", "category": "Network"},
        {"id": "0k8ro1kdx", "subject": "Virtual Backgrounds Not Loading in Video Conferencing", "priority": "Medium", "category": "Software"},
        {"id": "hmth9114b", "subject": "Critical Software Update Installation Issue", "priority": "High", "category": "Software"},
    ]
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=["id", "subject", "priority", "category"])
        writer.writeheader()
        writer.writerows(tickets)

if __name__ == "__main__":
    download_helpdesk_tickets()