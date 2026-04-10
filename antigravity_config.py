"""
Antigravity Configuration Module
=================================
Central configuration for the Antigravity Skills optimization layer.
Contains city lists, depreciation rates, and extraction parameters.

This module has zero import-time side effects and no external dependencies.
"""

# ---------------------------------------------------------------------------
# KNOWN_CITIES — 52 major Indian cities for native city extraction
# ---------------------------------------------------------------------------
KNOWN_CITIES: list[str] = [
    "Mumbai",
    "Pune",
    "Nagpur",
    "Delhi",
    "Bengaluru",
    "Hyderabad",
    "Chennai",
    "Kolkata",
    "Ahmedabad",
    "Surat",
    "Jaipur",
    "Lucknow",
    "Kanpur",
    "Indore",
    "Bhopal",
    "Patna",
    "Vadodara",
    "Ghaziabad",
    "Ludhiana",
    "Agra",
    "Nashik",
    "Faridabad",
    "Meerut",
    "Rajkot",
    "Varanasi",
    "Srinagar",
    "Aurangabad",
    "Dhanbad",
    "Amritsar",
    "Navi Mumbai",
    "Allahabad",
    "Ranchi",
    "Howrah",
    "Coimbatore",
    "Jabalpur",
    "Gwalior",
    "Vijayawada",
    "Jodhpur",
    "Madurai",
    "Raipur",
    "Kota",
    "Chandigarh",
    "Guwahati",
    "Solapur",
    "Hubballi",
    "Mysuru",
    "Tiruchirappalli",
    "Thiruvananthapuram",
    "Bhubaneswar",
    "Visakhapatnam",
    "Thane",
    "Noida",
]

# ---------------------------------------------------------------------------
# DEPRECIATION_RATES — annual depreciation % by asset category
# ---------------------------------------------------------------------------
DEPRECIATION_RATES: dict[str, float] = {
    "Computer": 33.33,
    "Laptop": 33.33,
    "Server": 20.0,
    "Printer": 20.0,
    "Furniture": 10.0,
    "Vehicle": 15.0,
    "AC": 15.0,
    "UPS": 15.0,
    "Mobile": 20.0,
    "Default": 10.0,
}

# ---------------------------------------------------------------------------
# ASSET_LIFE_YEARS — default useful life in years by asset category
# Used as fallback when warranty/useful-life data is missing from import
# ---------------------------------------------------------------------------
ASSET_LIFE_YEARS: dict[str, float] = {
    "Plant & Machinery": 15.0,
    "Office Equipments": 5.0,
    "Computer": 3.0,
    "Building": 30.0,
    "Pipeline and Bridges": 30.0,
    "Electrical Fitting": 10.0,
    "Furniture and Fixture": 10.0,
    "Laptop": 4.0,
    "Desktop": 5.0,
    "Server": 7.0,
    "Printer": 5.0,
    "Office Furniture": 10.0,
    "Air Conditioner": 8.0,
    "Vehicle": 8.0,
    "AC": 8.0,
    "UPS": 5.0,
    "Mobile": 3.0,
    "Default": 5.0,
}

# ---------------------------------------------------------------------------
# EXTRACTION_CONFIG — runtime parameters for extraction pipeline
# ---------------------------------------------------------------------------
EXTRACTION_CONFIG: dict = {
    "BATCH_SIZE": 20,
    "PINCODE_PATTERN_IN": r"\b[1-9][0-9]{5}\b",
    "PINCODE_PATTERN_US": r"\b[0-9]{5}(?:-[0-9]{4})?\b",
    "MIN_CONFIDENCE_SCORE": 0.7,
    "FALLBACK_TO_AI": True,
    "AI_MODEL": "claude-sonnet-4-20250514",
}
