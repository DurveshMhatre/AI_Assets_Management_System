**ENCUREIT — Asset Management Division**	CONFIDENTIAL


**ENCUREIT PRIVATE LIMITED**

Asset Management Division  |  stemassets.encureit.co.in

**TECHNICAL NOTE & PROPOSED SOLUTION**

Government Tender — Fixed Asset Valuation, Maintenance Segregation

& Accelerated Asset Upload Completion


|**Prepared by**|Encureit Asset Management Team||
| :- | :- | :- |
|**Submitted to**|Project Manager & Govt. Engineer — Concerned Department||
|**Date**|June 2026||
|**Classification**|**Confidential — For Official Use Only**||
|**Reference**|Asset Upload Project — Pending Units (Phase Final)||


# **1. Executive Summary**
The majority of the government organisation's assets have been successfully uploaded to the Encureit Asset Management System (stemassets.encureit.co.in). Only a small number of major units remain pending due to a specific challenge: their tender files contain bundled cost components — Supply, Installation, Demolition, and Maintenance — which, if taken at face value as the total estimated tender value, would result in incorrect Fixed Asset valuations.

This document presents a practical, time-saving solution that avoids the need to revisit previous (completed) tender files, eliminates project timeline delays, and enables the pending assets to be uploaded with appropriate, defensible values — sourced directly from the new tender currently under review.

# **2. Problem Statement**
## **2.1  Current Situation**
- The majority of assets across the government organisation are already uploaded and active in the asset register.
- 1–2 major unit categories remain pending for final upload.
- These pending assets were procured via government tenders containing B-1 Schedule (Bill of Quantities) entries that bundle together multiple cost heads.

## **2.2  The Core Accounting Challenge**
The tender B-1 Schedule typically includes the following cost components as a single estimated value:

|**#**|**Cost Component**|**Nature**|**Correct Treatment**|
| :-: | :- | :- | :- |
|1|Supply / Equipment Cost|Purchase price of the asset itself|**CAPITALIZE as Fixed Asset**|
|2|Installation / Commissioning Charges|Directly attributable to bringing asset to working condition|**CAPITALIZE as Fixed Asset**|
|3|Site Preparation / Civil Work|If inseparable from the asset installation|**CAPITALIZE (if inseparable)**|
|4|Demolition / Dismantling of Old Assets|Removal of previous asset — not part of new asset cost|**EXPENSE to P&L (Revenue)**|
|5|Annual Maintenance / AMC Charges|Recurring service cost over contract period|**EXPENSE to P&L / Prepaid**|
|6|GST (where Input Credit is available)|Recoverable tax — not a cost to the organisation|**DO NOT CAPITALIZE**|

Accounting Reference: Ind AS 16 (Para 16–17) / AS 10 (Para 9) — only costs directly attributable to bringing the asset to its working condition and location are to be capitalised.

## **2.3  Why the Current Approach Creates a Problem**
- **Full tender value capitalised:** 

When the Accounts department takes the complete estimated tender value and enters it as the Fixed Asset value, the figure includes Demolition and Maintenance charges. This inflates the asset register, violates AS 10 / Ind AS 16, and creates a mismatch between the Encureit system and the accounts books.

- **Previous tender file review is time-consuming:** 

Extracting maintenance values from already-processed, archived tender files to correct each asset record would require significant man-hours and is likely to extend the project timeline unacceptably — especially for the 1–2 major pending units.

# **3. Proposed Solution**
**We propose a two-part approach that resolves the valuation problem without requiring any review of previous tender files.**

## **3.1  Use the New Tender's B-1 Schedule as the Benchmark**
Since a new tender is currently under review, the B-1 Schedule of this new tender contains itemised rates for Supply, Installation, Demolition, and Maintenance — all broken out separately. These rates can be used as the basis for computing the correct capitalised value for the pending major units, using the following formula:

|<p>**CAPITALISED FIXED ASSET VALUE**</p><p>**=  Supply / Equipment Cost  +  Installation Charges  +  Civil / Site Prep (if applicable)  +  Freight & Insurance**</p><p>(Exclude: Demolition charges  |  Exclude: Maintenance / AMC  |  Exclude: GST if credit available)</p>|
| :-: |

**Steps to implement:**

1. Obtain the B-1 Schedule / BOQ from the new tender currently under review.
1. Extract line-item rates for: Supply, Installation, Demolition, and Maintenance separately.
1. Apply the capitalisation formula above to compute the Fixed Asset Value per unit.
1. Use these values to complete the pending asset uploads in stemassets.encureit.co.in.
1. Prepare a Cost Disaggregation Certificate (template provided in Section 5) for audit trail.

## **3.2  Handling Maintenance Value — Without Revisiting Old Tenders**
The concern about maintenance charges from previous tenders is addressed as follows:

||**Scenario**|**Recommended Action**|
| :-: | :- | :- |
|**A**|Maintenance value from old tender is needed for record correction only|Use the rate from the new tender B-1 Schedule as a reasonable proxy. Since maintenance rates are typically standard or index-linked, this is a defensible approximation.|
|**B**|Maintenance charges are recurring AMC across multiple years|Book as Prepaid Expense in accounts, charged annually to P&L. Do not bring into the Fixed Asset register. This keeps the asset register clean.|
|**C**|Old tender's maintenance value is needed for depreciation base correction|No action needed. Maintenance is never part of the depreciation base (Ind AS 16). Simply exclude it. The existing uploaded assets' depreciation is unaffected.|
|**D**|Demolition of old asset was included in the tender|Write off the old asset's Net Book Value in the period of demolition. Record demolition cost as loss/expense in P&L. This is a separate accounting entry, not a Fixed Asset addition.|

# **4. Reconciliation Statement Template**
The following statement should be prepared for each tender and shared between the Encureit system team and the Accounts department to resolve the mismatch:

|**#**|**Cost Component**|**Amount (Rs.)**|**Treatment**|
| :-: | :- | :-: | :- |
|1|Supply / Equipment Cost|Rs. \_\_\_\_\_\_\_\_\_\_|**Fixed Asset (Capitalise)**|
|2|Installation / Commissioning|Rs. \_\_\_\_\_\_\_\_\_\_|**Fixed Asset (Capitalise)**|
|3|Civil / Site Preparation (if any)|Rs. \_\_\_\_\_\_\_\_\_\_|**Fixed Asset (if inseparable)**|
|4|Demolition / Dismantling Charges|Rs. \_\_\_\_\_\_\_\_\_\_|**P&L Expense — Do Not Capitalise**|
|5|Annual Maintenance (AMC)|Rs. \_\_\_\_\_\_\_\_\_\_|**P&L / Prepaid — Do Not Capitalise**|
|6|GST (net of input credit)|Rs. \_\_\_\_\_\_\_\_\_\_|**Exclude from Fixed Asset**|
||**TOTAL TENDER VALUE (B-1 Estimate)**|**Rs. \_\_\_\_\_\_\_\_\_\_**|**As per Tender File**|
||**FIXED ASSET VALUE (Items 1+2+3 only)**|**Rs. \_\_\_\_\_\_\_\_\_\_**|**Enter in Asset Register / Encureit System**|

# **5. Cost Disaggregation Certificate (Template for Audit)**
The following certificate should be signed by the authorised engineer/project manager and submitted along with the tender documents to support the asset register entries:

|<p>**COST DISAGGREGATION CERTIFICATE**</p><p>(For Fixed Asset Capitalisation under Ind AS 16 / AS 10)</p><p>Tender Reference No.: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_</p><p>Name of Work / Project: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_</p><p>Organisation / Department: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_</p><p>Asset Tag Nos. (Encureit): \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_</p><p>Date of Certification: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_</p><p>I / We hereby certify that the cost components of the above-referenced tender have been disaggregated as follows, in accordance with applicable accounting standards:</p><p></p><p>`  `Supply / Equipment Cost:     Rs. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_</p><p>`  `Installation / Commissioning: Rs. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_</p><p>`  `Civil / Site Preparation:     Rs. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_</p><p>`  `Demolition Charges:           Rs. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  (Expensed to P&L)</p><p>`  `Maintenance / AMC:            Rs. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  (Expensed / Prepaid)</p><p>`  `**CAPITALISED FIXED ASSET VALUE: Rs. \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**</p><p>Authorised by:</p><p>Project Manager: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  Sign: \_\_\_\_\_\_\_\_\_\_\_\_\_  Date: \_\_\_\_\_\_\_\_</p><p>Govt. Engineer:  \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  Sign: \_\_\_\_\_\_\_\_\_\_\_\_\_  Date: \_\_\_\_\_\_\_\_</p><p>Accounts Dept:   \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  Sign: \_\_\_\_\_\_\_\_\_\_\_\_\_  Date: \_\_\_\_\_\_\_\_</p>|
| :-: |

# **6. Project Timeline Impact Assessment**

|**Approach**|**Estimated Time Required**|**Risk Level**|
| :- | :- | :- |
|Review all previous tender files to extract maintenance values|**2–4 weeks (per major unit category)**|HIGH — tender files may be incomplete, archived, or require approvals for access|
|Use new tender B-1 Schedule rates as benchmark (PROPOSED)|**1–2 days (once B-1 is received)**|LOW — new tender is already under review; rates are current and auditable|
|Take full tender value (current accounts approach)|**Immediate — but creates compliance issues**|HIGH — violates Ind AS 16; inflated asset register; audit risk|

# **7. Recommended Action Plan**

|**Step**|**Action**|**Details**|**Responsible**|
| :-: | :- | :- | :- |
|**1**|Obtain new tender B-1 Schedule|Request the itemised BOQ from the new tender currently under review. Ensure line items are separately priced.|Project Manager / Procurement Team|
|**2**|Disaggregate costs using formula|Apply capitalisation formula: Supply + Installation + Civil only. Exclude Demolition, Maintenance, and GST.|Encureit Asset Team + Accounts|
|**3**|Prepare Cost Disaggregation Certificate|Use the template in Section 5. Get signatures from Project Manager, Govt. Engineer, and Accounts.|Project Manager + Govt. Engineer|
|**4**|Upload pending assets to Encureit system|Enter the disaggregated Fixed Asset Value (not full tender value) in stemassets.encureit.co.in for each unit.|Encureit Asset Team|
|**5**|Reconcile with Accounts department|Submit Reconciliation Statement (Section 4) to Accounts. Align their books with the corrected Fixed Asset value.|Accounts + Encureit Team|
|**6**|Run depreciation on correct base|Depreciation in the Encureit system to be run on the capitalised value only, using useful life per Schedule II / policy.|Encureit System (Automated)|

# **8. Conclusion**
The proposed approach ensures that the pending major units are uploaded to the Encureit asset management system quickly, correctly, and in full compliance with Indian accounting standards — without the need to revisit or audit previous tender files.

By using the B-1 Schedule of the new tender currently under review as the cost benchmark, we can derive appropriate and defensible Fixed Asset values within 1–2 working days of receiving the itemised BOQ. This approach keeps the project on schedule, produces an accurate and auditable asset register, and resolves the mismatch that currently exists between the Encureit system and the Accounts department.

**We request the Project Manager and Govt. Engineer to:**

- Provide the B-1 Schedule (itemised BOQ) from the new tender at the earliest.
- Sign the Cost Disaggregation Certificate (Section 5) once values are computed.
- Direct the Accounts department to use the disaggregated Fixed Asset Value (not total tender value) for booking.

Encureit's asset team is ready to complete the upload immediately upon receipt of the above.



Encureit Private Limited  |  encureit.co.in  |  Asset Management Division

This document is prepared for official use. All figures to be filled in by the authorised team.
Govt Tender Asset Management — Proposed Solution	Page 1 of 2
