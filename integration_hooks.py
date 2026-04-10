"""
Integration Hooks — Drop-in Enrichment for Pandas Pipelines
=============================================================
Drop these snippets into your existing main.py or processor.py.
Each block is self-contained and non-destructive.  Add them around
your existing ``df.apply()`` or loop logic.

**Zero import-time side effects** — importing this module does not
run any code, connect to any service, or print anything.

Requirements:
    pip install pandas python-dateutil
    pip install anthropic          # optional — only for AI fallback
"""

import pandas as pd


def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Full-pipeline enrichment: address extraction + depreciation + AI flush.

    Performs the following **non-destructive** steps on *df*:

    1. If an ``"Address"`` column exists, extract ``Pincode`` and ``City``
       using native regex matching.
    2. If ``"Purchase Date"`` and ``"Warranty"`` columns exist, compute
       depreciation metrics and append them as new columns.
    3. Flush any pending AI extraction requests and back-fill rows where
       native extraction returned ``None``.
    4. Print a cost report (native vs AI hits).

    Args:
        df: A pandas DataFrame.  Expected columns (all optional):
            ``Address``, ``Purchase Date``, ``Warranty``,
            ``Asset Category``, ``Current Value``.

    Returns:
        The same DataFrame with additional columns appended.

    Note:
        AI calls are triggered **only** when ``FALLBACK_TO_AI`` is ``True``
        in config **and** native extraction could not resolve a field.
    """
    from antigravity_skills import AntigravityRouter

    router = AntigravityRouter()

    # ── 1. Address extraction ─────────────────────────────────────────
    if "Address" in df.columns:
        address_results = df["Address"].apply(
            lambda x: router.process_native(str(x)) if pd.notna(x)
            else pd.Series({"Pincode": None, "City": None})
        )
        df[["Pincode", "City"]] = address_results

    # ── 2. Depreciation calculation (via safe_calculate_depreciation) ──
    #    Uses column discovery + ASSET_LIFE_YEARS fallback. No Assign-To gate.
    def _safe_calc_row(row):
        try:
            result = router.safe_calculate_depreciation(row.to_dict())
            if "error" in result:
                return pd.Series({
                    "Depreciation_%": None,
                    "Remaining_Life_Yrs": None,
                    "Asset_Status": None,
                    "Book_Value": None,
                    "Warranty_Source": result.get("warranty_source"),
                })
            return pd.Series({
                "Depreciation_%": result["depreciation_percentage"],
                "Remaining_Life_Yrs": result["remaining_life_years"],
                "Asset_Status": result["asset_status"],
                "Book_Value": result["current_book_value"],
                "Warranty_Source": result.get("warranty_source"),
            })
        except Exception as exc:
            print(f"[enrich_dataframe] depreciation error: {exc}")
            return pd.Series({
                "Depreciation_%": None,
                "Remaining_Life_Yrs": None,
                "Asset_Status": None,
                "Book_Value": None,
                "Warranty_Source": None,
            })

    depr_cols = df.apply(_safe_calc_row, axis=1)
    df[["Depreciation_%", "Remaining_Life_Yrs",
        "Asset_Status", "Book_Value", "Warranty_Source"]] = depr_cols

    # ── 3. Flush AI queue & back-fill ─────────────────────────────────
    ai_results = router.ai_engine.flush_queue()
    if ai_results:
        for idx, row in df.iterrows():
            if idx in ai_results:
                ai_data = ai_results[idx]
                if pd.isna(row.get("Pincode")) and "pincode" in ai_data:
                    df.at[idx, "Pincode"] = ai_data["pincode"]
                if pd.isna(row.get("City")) and "city" in ai_data:
                    df.at[idx, "City"] = ai_data["city"]

    # ── 4. Cost report ────────────────────────────────────────────────
    print(router.get_cost_report())

    return df


def extract_any_field(
    df: pd.DataFrame,
    source_column: str,
    field_hint: str,
    output_column: str,
) -> pd.DataFrame:
    """General-purpose field extraction hook for any field type.

    Applies ``AntigravityRouter.extract_field`` to every row of
    *source_column* and stores the result in *output_column*.

    Args:
        df:            Input DataFrame.
        source_column: Column containing raw text to extract from.
        field_hint:    Extraction type hint (``"email"``, ``"phone"``,
                       ``"pincode"``, ``"city"``, ``"amount"``,
                       ``"date"``).
        output_column: Name of the new column to store results.

    Returns:
        The same DataFrame with *output_column* appended.

    Example::

        df = extract_any_field(df, "Notes", "email", "Contact_Email")

    Note:
        Strictly native — **never** triggers an AI call.
    """
    from antigravity_skills import AntigravityRouter

    router = AntigravityRouter()
    df[output_column] = df[source_column].apply(
        lambda x: router.extract_field(str(x), field_hint)
        if pd.notna(x) else None
    )
    return df


def add_depreciation_columns(
    df: pd.DataFrame,
    date_col: str,
    warranty_col: str,
    category_col: str | None = None,
    value_col: str | None = None,
) -> pd.DataFrame:
    """Flexible depreciation enrichment with custom column names.

    Applies ``AntigravityRouter.calculate_depreciation`` row-wise and
    expands the result into individual columns prefixed with ``Depr_``.

    Args:
        df:           Input DataFrame.
        date_col:     Column containing purchase dates.
        warranty_col: Column containing warranty period in years.
        category_col: Optional column with asset category names.
        value_col:    Optional column with current/purchase values.

    Returns:
        The same DataFrame with new columns: ``Depr_Percentage``,
        ``Depr_RemainingYears``, ``Depr_Status``, ``Depr_BookValue``.

    Note:
        Strictly native — **never** triggers an AI call.
    """
    from antigravity_skills import AntigravityRouter

    router = AntigravityRouter()

    def _calc_row(row):
        try:
            category = (
                str(row[category_col])
                if category_col and pd.notna(row.get(category_col))
                else "Default"
            )
            value = (
                row[value_col]
                if value_col and pd.notna(row.get(value_col))
                else None
            )
            result = router.calculate_depreciation(
                row[date_col],
                row[warranty_col],
                asset_category=category,
                current_value=value,
            )
            if "error" in result:
                return pd.Series({
                    "Depr_Percentage": None,
                    "Depr_RemainingYears": None,
                    "Depr_Status": None,
                    "Depr_BookValue": None,
                })
            return pd.Series({
                "Depr_Percentage": result["depreciation_percentage"],
                "Depr_RemainingYears": result["remaining_life_years"],
                "Depr_Status": result["asset_status"],
                "Depr_BookValue": result["current_book_value"],
            })
        except Exception as exc:
            print(f"[add_depreciation_columns] error: {exc}")
            return pd.Series({
                "Depr_Percentage": None,
                "Depr_RemainingYears": None,
                "Depr_Status": None,
                "Depr_BookValue": None,
            })

    depr_cols = df.apply(_calc_row, axis=1)
    df[["Depr_Percentage", "Depr_RemainingYears",
        "Depr_Status", "Depr_BookValue"]] = depr_cols

    return df
