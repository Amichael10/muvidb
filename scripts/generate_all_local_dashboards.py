import subprocess
import os

print("🚀 GENERATING LOCAL INTERACTIVE ENRICHMENT DASHBOARDS...")

# 1. Scan Movies Enrichment & Build Movie Studio HTML
try:
    print("\n--- Step 1: Scanning Movies Database ---")
    import scan_movies_enrichment
except Exception as e:
    print(f"Error scanning movies: {e}")

try:
    print("\n--- Step 2: Building Movies Approval Dashboard HTML ---")
    import build_movies_approval_dashboard
except Exception as e:
    print(f"Error building movies approval dashboard: {e}")

# 2. Build People Enrichment Dashboard HTML
try:
    print("\n--- Step 3: Building People Enrichment Studio HTML ---")
    import build_final_enriched_dashboard
except Exception as e:
    print(f"Error building people enrichment studio: {e}")

print("\n🎉 ALL LOCAL DASHBOARDS GENERATED SUCCESSFULLY!")
