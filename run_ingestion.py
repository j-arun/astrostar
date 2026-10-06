#!/usr/bin/env python3
"""
Simple 1-Command Runner for Tamil Horoscope Ingestion.
Reads all database credentials and file options directly from config.ini.

Usage:
    python3 run_ingestion.py
"""
import os
import sys

# Ensure scripts folder is importable
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_PATH = os.path.join(SCRIPT_DIR, "scripts")
if SCRIPTS_PATH not in sys.path:
    sys.path.insert(0, SCRIPTS_PATH)

try:
    from extract_tamil_horoscope import main
    if __name__ == "__main__":
        main()
except ImportError as e:
    print(f"Error importing extraction module: {e}")
    sys.exit(1)
