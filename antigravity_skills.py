"""
Antigravity Skills — Core Extraction & Depreciation Engine
===========================================================
Three-class architecture:
  1. NativeExtractor   — zero-cost regex/math extractions (no network calls)
  2. AIFallbackEngine  — batched Anthropic API calls for unresolvable rows
  3. AntigravityRouter  — orchestrator; the only class external code imports

Philosophy: native logic first, AI as a last resort.
"""

import json
import math
import re
from datetime import datetime, timedelta

import pandas as pd
from dateutil.relativedelta import relativedelta

# Conditional import — file must load even when anthropic is not installed
try:
    import anthropic  # type: ignore
except ImportError:
    anthropic = None  # type: ignore

from antigravity_config import (
    ASSET_LIFE_YEARS,
    DEPRECIATION_RATES,
    EXTRACTION_CONFIG,
    KNOWN_CITIES,
)


# ═══════════════════════════════════════════════════════════════════════════
# Class 1: NativeExtractor
# ═══════════════════════════════════════════════════════════════════════════

class NativeExtractor:
    """Zero-cost extraction engine.  Every method runs locally — no network
    calls, no API keys, no billable operations.  Regex patterns are compiled
    once in ``__init__`` for maximum throughput.
    """

    def __init__(self) -> None:
        # Pre-compiled regex patterns from config
        self._pin_in = re.compile(EXTRACTION_CONFIG["PINCODE_PATTERN_IN"])
        self._pin_us = re.compile(EXTRACTION_CONFIG["PINCODE_PATTERN_US"])

        # Field-specific patterns (compiled once)
        self._patterns: dict[str, re.Pattern] = {
            "email": re.compile(
                r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
            ),
            "phone": re.compile(r"(\+91[\-\s]?)?[6-9]\d{9}"),
            "amount": re.compile(
                r"(?:Rs\.?|INR|₹)\s?[\d,]+(?:\.\d{2})?"
            ),
            "date": re.compile(
                r"\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b"
            ),
        }

        # Date-parsing formats tried in order
        self._date_formats: list[str] = [
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y-%m-%d",
            "%d-%b-%Y",
            "%B %d, %Y",
        ]

    # ── pincode ───────────────────────────────────────────────────────────

    def extract_pincode(self, text: str) -> str | None:
        """Extract a 6-digit Indian pincode or 5/9-digit US ZIP from *text*.

        Args:
            text: Any raw string (e.g. a full address cell value).

        Returns:
            The first matching pincode/ZIP as a stripped string, or ``None``.

        Note:
            Pure regex — **never** triggers an AI call.
        """
        if not text or not isinstance(text, str):
            return None
        try:
            matches = self._pin_in.findall(text)
            if not matches:
                matches = self._pin_us.findall(text)
            return matches[0].strip() if matches else None
        except Exception as exc:
            print(f"[NativeExtractor.extract_pincode] error on input "
                  f"'{text[:80]}': {exc}")
            return None

    # ── city ──────────────────────────────────────────────────────────────

    def extract_city(self, text: str, city_list: list | None = None) -> str | None:
        """Find a known city name inside *text* using whole-word matching.

        Args:
            text:      Any raw string.
            city_list: Optional override; defaults to ``KNOWN_CITIES`` from
                       config.

        Returns:
            The city name in its original casing, or ``None``.

        Note:
            Pure regex — **never** triggers an AI call.
        """
        if not text or not isinstance(text, str):
            return None
        if city_list is None:
            city_list = KNOWN_CITIES

        text_lower = text.lower()
        try:
            for city in city_list:
                if re.search(r"\b" + re.escape(city.lower()) + r"\b",
                             text_lower):
                    return city
        except Exception as exc:
            print(f"[NativeExtractor.extract_city] error on input "
                  f"'{text[:80]}': {exc}")
        return None

    # ── general field extraction ──────────────────────────────────────────

    def extract_field_from_text(
        self, text: str, field_hint: str
    ) -> str | None:
        """Smart extractor for any field embedded in unstructured text.

        Args:
            text:       Raw string to search.
            field_hint: One of ``"email"``, ``"phone"``, ``"pincode"``,
                        ``"city"``, ``"state"``, ``"country"``, ``"date"``,
                        ``"amount"``, ``"serial_number"``.

        Returns:
            First match as a stripped string, or ``None``.
            For unrecognised *field_hint* values, returns ``None`` without
            guessing.

        Note:
            Pure regex — **never** triggers an AI call.
        """
        if not text or not isinstance(text, str):
            return None

        hint = field_hint.lower().strip()
        try:
            # Delegate to specialised methods
            if hint == "pincode":
                return self.extract_pincode(text)
            if hint == "city":
                return self.extract_city(text)

            # Use pre-compiled pattern if available
            pattern = self._patterns.get(hint)
            if pattern:
                match = pattern.search(text)
                return match.group(0).strip() if match else None

            # Unrecognised hint — do not guess
            return None

        except Exception as exc:
            print(f"[NativeExtractor.extract_field_from_text] error on "
                  f"field_hint='{field_hint}', input='{text[:80]}': {exc}")
            return None

    # ── depreciation engine ───────────────────────────────────────────────

    def calculate_depreciation(
        self,
        purchase_date,
        warranty_years: float,
        asset_category: str = "Default",
        current_value: float | None = None,
    ) -> dict:
        """Calculate depreciation metrics for an asset.

        Args:
            purchase_date:  ``datetime``, pandas ``Timestamp``, or date
                            string in common Indian/ISO formats.
            warranty_years: Warranty period in years (0 is valid).
            asset_category: Key into ``DEPRECIATION_RATES`` (case-sensitive).
                            Falls back to ``"Default"`` if not found.
            current_value:  Optional purchase/current cost.  Strings with
                            currency symbols (``₹``, ``Rs.``, ``₹``) are
                            auto-stripped and parsed as float.

        Returns:
            A dict with keys: ``purchase_date_parsed``,
            ``years_elapsed``, ``annual_depreciation_rate``,
            ``depreciation_percentage``, ``remaining_life_years``,
            ``asset_status``, ``current_book_value``.
            On unparseable dates, returns ``{"error": "unparseable_date"}``.

        Note:
            Strictly native — **never** triggers an AI call.
        """
        # ── parse purchase_date ───────────────────────────────────────
        parsed_date: datetime | None = None

        # Handle pandas Timestamp
        try:
            import pandas as _pd  # noqa: F811
            if isinstance(purchase_date, _pd.Timestamp):
                parsed_date = purchase_date.to_pydatetime()
        except Exception:
            pass

        # Handle datetime objects
        if parsed_date is None and isinstance(purchase_date, datetime):
            parsed_date = purchase_date

        # Handle strings
        if parsed_date is None and isinstance(purchase_date, str):
            for fmt in self._date_formats:
                try:
                    parsed_date = datetime.strptime(purchase_date.strip(), fmt)
                    break
                except (ValueError, TypeError):
                    continue

        if parsed_date is None:
            return {"error": "unparseable_date"}

        # ── parse current_value (strip currency symbols) ──────────────
        if current_value is not None and isinstance(current_value, str):
            try:
                cleaned = re.sub(r"[₹,Rs.\s]", "", current_value)
                current_value = float(cleaned)
            except (ValueError, TypeError):
                current_value = None
        elif current_value is not None:
            try:
                current_value = float(current_value)
            except (ValueError, TypeError):
                current_value = None

        # ── ensure warranty_years is numeric ──────────────────────────
        try:
            warranty_years = float(warranty_years)
        except (ValueError, TypeError):
            warranty_years = 0.0

        # ── compute years elapsed ─────────────────────────────────────
        now = datetime.now()
        if parsed_date > now:
            # Future purchase date — no depreciation yet
            years_elapsed = 0.0
        else:
            delta = relativedelta(now, parsed_date)
            years_elapsed = delta.years + delta.months / 12 + delta.days / 365

        # ── look up depreciation rate ─────────────────────────────────
        annual_rate = DEPRECIATION_RATES.get(
            asset_category, DEPRECIATION_RATES["Default"]
        )

        # ── calculate metrics ─────────────────────────────────────────
        depreciation_pct = min(years_elapsed * annual_rate, 100.0)
        remaining_life = max(warranty_years - years_elapsed, 0.0)

        # ── determine status ──────────────────────────────────────────
        if depreciation_pct >= 100.0:
            asset_status = "Fully Depreciated"
        elif remaining_life <= 0.0:
            asset_status = "Expired"
        else:
            asset_status = "Active"

        # ── book value ────────────────────────────────────────────────
        book_value = None
        if current_value is not None:
            book_value = round(current_value * (1 - depreciation_pct / 100), 2)

        return {
            "purchase_date_parsed": parsed_date.strftime("%Y-%m-%d"),
            "years_elapsed": round(years_elapsed, 2),
            "annual_depreciation_rate": annual_rate,
            "depreciation_percentage": round(depreciation_pct, 2),
            "remaining_life_years": round(remaining_life, 2),
            "asset_status": asset_status,
            "current_book_value": book_value,
        }

    # ── warranty parser ────────────────────────────────────────────────

    def parse_warranty_input(self, raw_value) -> float | None:
        """Smart warranty/useful-life parser handling multiple input formats.

        Args:
            raw_value: Any of:
                - Plain int/float < 100 (e.g. ``3`` → 3.0 years)
                - String with units (e.g. ``"3 Years"`` → 3.0)
                - Date string (e.g. ``"31/12/2027"`` → years remaining)
                - Excel serial integer > 1000 (e.g. ``45291`` → date → years remaining)
                - pandas Timestamp / datetime → years remaining
                - ``None`` / ``NaN`` / empty → ``None``

        Returns:
            Warranty duration in years as float, or ``None``.

        Note:
            Pure native — **never** triggers an AI call.
        """
        # Handle None / NaN / empty
        if raw_value is None:
            return None
        try:
            import pandas as _pd
            if _pd.isna(raw_value):
                return None
        except Exception:
            pass
        if isinstance(raw_value, str) and raw_value.strip() == '':
            return None

        # Handle pandas Timestamp
        try:
            import pandas as _pd
            if isinstance(raw_value, _pd.Timestamp):
                delta = relativedelta(raw_value.to_pydatetime(), datetime.now())
                years_remaining = delta.years + delta.months / 12
                return max(round(years_remaining, 2), 0.0)
        except Exception:
            pass

        # Handle datetime objects
        if isinstance(raw_value, datetime):
            delta = relativedelta(raw_value, datetime.now())
            years_remaining = delta.years + delta.months / 12
            return max(round(years_remaining, 2), 0.0)

        # Try numeric
        try:
            num = float(raw_value)
            if math.isnan(num):
                return None
            # Plain duration (< 100 = years directly)
            if num < 100:
                return round(num, 2)
            # Excel serial number (> 1000)
            if num > 1000:
                excel_epoch = datetime(1899, 12, 30)
                converted_date = excel_epoch + timedelta(days=int(num))
                delta = relativedelta(converted_date, datetime.now())
                years_remaining = delta.years + delta.months / 12
                return max(round(years_remaining, 2), 0.0)
            # 100-1000 range: treat as years (unusual but possible)
            return round(num, 2)
        except (ValueError, TypeError):
            pass

        # Handle string with text units: "3 Years", "3 Yrs", "5 years"
        if isinstance(raw_value, str):
            txt = raw_value.strip()
            match = re.match(r'^([\d.]+)\s*(?:years?|yrs?)\s*$', txt, re.IGNORECASE)
            if match:
                return round(float(match.group(1)), 2)

            # Try parsing as date string
            for fmt in self._date_formats:
                try:
                    parsed = datetime.strptime(txt, fmt)
                    delta = relativedelta(parsed, datetime.now())
                    years_remaining = delta.years + delta.months / 12
                    return max(round(years_remaining, 2), 0.0)
                except (ValueError, TypeError):
                    continue

        return None

    # ── safe depreciation engine ──────────────────────────────────────

    def safe_calculate_depreciation(self, row_dict: dict) -> dict:
        """Resilient depreciation calculator with column discovery and defaults.

        Unlike ``calculate_depreciation``, this method:
          - Tries multiple column name variants for each field
          - Falls back to ``ASSET_LIFE_YEARS`` when warranty is missing
          - Removes the "Assign To" gate — calculates regardless
          - Never silently skips — always returns a result dict

        Args:
            row_dict: A dictionary representing one row of data. Keys can
                      vary (e.g. ``'Purchase Date'``, ``'Date of Purchase'``,
                      ``'purchase_date'``, ``'bought_on'``).

        Returns:
            Dict with depreciation metrics, or error dict if purchase date
            is missing.

        Note:
            Pure native — **never** triggers an AI call.
        """
        # ── Step 1: Column discovery ──────────────────────────────────
        def _find(keys: list, default=None):
            for k in keys:
                if k in row_dict and row_dict[k] is not None:
                    val = row_dict[k]
                    try:
                        import pandas as _pd
                        if _pd.isna(val):
                            continue
                    except Exception:
                        pass
                    return val
            return default

        purchase_date = _find([
            'Purchase Date', 'Date of Purchase', 'purchase_date', 'bought_on'
        ])
        raw_warranty = _find([
            'Warranty', 'Warranty Years', 'Useful Life', 'Life Years'
        ])
        asset_category = _find([
            'Asset Type', 'Category', 'asset_type'
        ], 'Default')
        current_value = _find([
            'Value', 'Cost', 'Price', 'Purchase Price'
        ])

        # ── Step 2: Missing purchase date — can't calculate ───────────
        if purchase_date is None:
            return {
                'error': 'missing_purchase_date',
                'asset_status': 'Unverified',
                'depreciation_percentage': None,
                'remaining_life_years': None,
                'current_book_value': None,
                'warranty_source': None,
            }

        # ── Step 3: Parse warranty ────────────────────────────────────
        warranty_years = self.parse_warranty_input(raw_warranty)
        warranty_source = 'provided'

        if warranty_years is None or warranty_years <= 0:
            # Fallback to default by category
            cat_str = str(asset_category) if asset_category else 'Default'
            warranty_years = ASSET_LIFE_YEARS.get(
                cat_str, ASSET_LIFE_YEARS.get('Default', 5.0)
            )
            warranty_source = 'default_by_category'

        # ── Step 4: Delegate to core engine ───────────────────────────
        result = self.calculate_depreciation(
            purchase_date=purchase_date,
            warranty_years=warranty_years,
            asset_category=str(asset_category) if asset_category else 'Default',
            current_value=current_value,
        )

        result['warranty_source'] = warranty_source
        return result


# ═══════════════════════════════════════════════════════════════════════════
# Class 2: AIFallbackEngine
# ═══════════════════════════════════════════════════════════════════════════

class AIFallbackEngine:
    """Batched Anthropic API fallback for rows that ``NativeExtractor``
    could not resolve.  Expensive — call as rarely as possible.

    The engine queues items and fires a single API call per batch
    (``BATCH_SIZE`` from config) to minimise cost and round-trips.
    """

    def __init__(self) -> None:
        self._queue: list[dict] = []
        self._results: dict = {}

        try:
            if anthropic is not None:
                self.client = anthropic.Anthropic()
            else:
                self.client = None
                print("[AIFallbackEngine] anthropic library not installed — "
                      "AI fallback disabled.")
        except Exception as exc:
            self.client = None
            print(f"[AIFallbackEngine] could not initialise Anthropic "
                  f"client: {exc}")

    # ── queue management ──────────────────────────────────────────────

    def add_to_queue(
        self, record_id, raw_text: str, fields_needed: list
    ) -> None:
        """Add an extraction request to the internal queue.

        Args:
            record_id:     Unique identifier for the record (any hashable).
            raw_text:      The raw text to extract from.
            fields_needed: List of field names the AI should extract.

        Note:
            When the queue reaches ``BATCH_SIZE``, a batch is automatically
            processed — **this triggers an AI API call**.
        """
        self._queue.append({
            "id": record_id,
            "text": raw_text,
            "fields": fields_needed,
        })
        if len(self._queue) >= EXTRACTION_CONFIG["BATCH_SIZE"]:
            self._process_batch()

    # ── batch processing (PRIVATE) ────────────────────────────────────

    def _process_batch(self) -> None:
        """Process up to ``BATCH_SIZE`` queued items in a single API call.

        Warning:
            **This method triggers an external AI API call.**
            It is never called directly by user code — only via
            ``add_to_queue`` (auto-flush) or ``flush_queue`` (manual).
        """
        if self.client is None:
            print("[AIFallbackEngine._process_batch] no AI client — "
                  "clearing queue without processing.")
            self._queue.clear()
            return

        batch_size = EXTRACTION_CONFIG["BATCH_SIZE"]
        batch = self._queue[:batch_size]
        if not batch:
            return

        # Build prompt
        prompt_lines = [
            "You are a data extraction assistant. For each item below, "
            "extract only the requested fields from the raw text. "
            "Return a valid JSON object where each key is the item ID "
            "and the value is a dictionary of the extracted fields. "
            "If a field cannot be found, use null. "
            "Do not include any text outside the JSON object.\n",
        ]
        for item in batch:
            prompt_lines.append(
                f"Item ID: {item['id']}\n"
                f"Text: {item['text']}\n"
                f"Fields needed: {', '.join(item['fields'])}\n"
                f"---"
            )
        prompt = "\n".join(prompt_lines)

        try:
            response = self.client.messages.create(
                model=EXTRACTION_CONFIG["AI_MODEL"],
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            raw_text = response.content[0].text
            parsed = json.loads(raw_text)
            self._results.update(parsed)
        except json.JSONDecodeError:
            print(f"[AIFallbackEngine._process_batch] JSON parse failed. "
                  f"Raw response: {raw_text[:500]}")  # noqa: F821
            for item in batch:
                self._results[item["id"]] = {}
        except Exception as exc:
            print(f"[AIFallbackEngine._process_batch] API call failed: "
                  f"{exc}")
            for item in batch:
                self._results[item["id"]] = {}

        # Remove processed items
        self._queue = self._queue[batch_size:]

    # ── public flush ──────────────────────────────────────────────────

    def flush_queue(self) -> dict:
        """Process all remaining queued items regardless of batch size.

        Returns:
            Dict mapping ``record_id`` → extracted-fields dict for every
            item processed so far (including previously flushed batches).

        Note:
            **Triggers AI API calls** if there are pending items and a
            client is available.
        """
        while self._queue:
            self._process_batch()
        return self._results

    # ── result lookup ─────────────────────────────────────────────────

    def get_result(self, record_id) -> dict:
        """Look up the AI-extracted result for a given *record_id*.

        Args:
            record_id: The identifier used when the item was queued.

        Returns:
            Dict of extracted fields, or empty dict if not found.
        """
        return self._results.get(record_id, {})


# ═══════════════════════════════════════════════════════════════════════════
# Class 3: AntigravityRouter
# ═══════════════════════════════════════════════════════════════════════════

class AntigravityRouter:
    """Single entry-point orchestrator for the Antigravity Skills layer.

    External code only needs to import this class.  It routes every
    extraction request through ``NativeExtractor`` first and falls back
    to ``AIFallbackEngine`` only when native methods cannot resolve the
    data.
    """

    def __init__(self) -> None:
        self.native = NativeExtractor()
        self.ai_engine = AIFallbackEngine()
        self.stats: dict[str, int] = {
            "native_hits": 0,
            "ai_hits": 0,
            "misses": 0,
        }

    # ── address processing ────────────────────────────────────────────

    def process_address(
        self, address_string: str, record_id=None
    ) -> dict:
        """Extract pincode and city from an address string.

        Processing order:
          1. Native regex extraction (free).
          2. If partially resolved **and** ``FALLBACK_TO_AI`` is enabled,
             queue the missing fields for AI extraction.
          3. If AI is disabled or no ``record_id``, return partial result.

        Args:
            address_string: Raw address text.
            record_id:      Unique row identifier.  Required for AI
                            fallback queueing.

        Returns:
            Dict with ``pincode``, ``city``, and ``source`` (one of
            ``"native"``, ``"ai_pending"``, ``"native_partial"``).

        Note:
            AI calls happen only when *both* conditions are met:
            ``FALLBACK_TO_AI`` is ``True`` **and** ``record_id`` is
            provided.
        """
        pincode = self.native.extract_pincode(address_string)
        city = self.native.extract_city(address_string)

        # Step 3: both found natively
        if pincode and city:
            self.stats["native_hits"] += 1
            return {"pincode": pincode, "city": city, "source": "native"}

        # Step 4: partial — attempt AI fallback
        if EXTRACTION_CONFIG["FALLBACK_TO_AI"] and record_id is not None:
            missing: list[str] = []
            if not pincode:
                missing.append("pincode")
            if not city:
                missing.append("city")
            self.ai_engine.add_to_queue(record_id, address_string, missing)
            self.stats["ai_hits"] += 1
            return {"pincode": pincode, "city": city, "source": "ai_pending"}

        # Step 5: AI disabled or no record_id
        self.stats["misses"] += 1
        return {"pincode": pincode, "city": city, "source": "native_partial"}

    # ── pandas-compatible address extraction ──────────────────────────

    def process_native(self, address_string: str) -> pd.Series:
        """Extract pincode and city, returning a ``pd.Series``.

        Designed for direct use with ``df['Address'].apply()``.

        Args:
            address_string: Raw address text.

        Returns:
            ``pd.Series({"Pincode": ..., "City": ...})``

        Note:
            Uses **native extraction only** — never triggers an AI call.
        """
        result = self.process_address(address_string)
        return pd.Series({
            "Pincode": result.get("pincode"),
            "City": result.get("city"),
        })

    # ── depreciation delegate ─────────────────────────────────────────

    def calculate_depreciation(
        self,
        purchase_date,
        warranty_years: float,
        asset_category: str = "Default",
        current_value: float | None = None,
    ) -> dict:
        """Calculate depreciation for an asset.

        Delegates entirely to ``NativeExtractor.calculate_depreciation``.

        Args:
            purchase_date:  datetime, Timestamp, or string.
            warranty_years: Warranty period in years.
            asset_category: Key into ``DEPRECIATION_RATES``.
            current_value:  Optional purchase cost.

        Returns:
            Depreciation metrics dict.

        Note:
            Strictly native — **never** triggers an AI call.
        """
        return self.native.calculate_depreciation(
            purchase_date, warranty_years, asset_category, current_value
        )

    def safe_calculate_depreciation(self, row_dict: dict) -> dict:
        """Resilient depreciation with column discovery and defaults.

        Delegates to ``NativeExtractor.safe_calculate_depreciation``.
        Handles missing warranty, missing assign-to, and multiple column
        name variants automatically.

        Args:
            row_dict: Dictionary of row data with variable column names.

        Returns:
            Depreciation metrics dict.

        Note:
            Strictly native — **never** triggers an AI call.
        """
        return self.native.safe_calculate_depreciation(row_dict)

    # ── general field extraction delegate ─────────────────────────────

    def extract_field(self, text: str, field_hint: str) -> str | None:
        """Extract a single field from unstructured text.

        Delegates entirely to ``NativeExtractor.extract_field_from_text``.

        Args:
            text:       Raw string to search.
            field_hint: Field type hint (e.g. ``"email"``, ``"phone"``).

        Returns:
            Extracted value or ``None``.

        Note:
            Strictly native — **never** triggers an AI call.
        """
        return self.native.extract_field_from_text(text, field_hint)

    # ── cost report ───────────────────────────────────────────────────

    def get_cost_report(self) -> dict:
        """Return extraction statistics with estimated AI cost.

        Returns:
            Dict with ``native_hits``, ``ai_hits``, ``misses``, and
            ``estimated_ai_cost_usd`` (approx $0.003 per batch call).

        Note:
            This is a read-only stats method — **no AI call**.
        """
        return {
            **self.stats,
            "estimated_ai_cost_usd": round(
                self.stats["ai_hits"] * 0.003, 4
            ),
        }
