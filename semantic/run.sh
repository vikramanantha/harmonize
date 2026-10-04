#!/bin/sh
# Starts the similarity service the Harmony server calls (SEMANTIC_URL).
# First run: python3 -m venv .venv && .venv/bin/pip install sentence-transformers
cd "$(dirname "$0")" && exec .venv/bin/python service.py
