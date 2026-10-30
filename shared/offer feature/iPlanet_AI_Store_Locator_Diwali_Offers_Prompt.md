# iPlanet AI Store Locator -- Diwali Store Offers & Bank Offers Integration

## 1. Project Objective

Enhance the existing **iPlanet AI Store Locator** by adding two
automated offer panels to the existing Home Page:

1.  **Diwali Special -- Store Offers** (top-left)
2.  **Diwali Special -- Bank Offers** (bottom-left)

The existing Store Locator should remain in its current
central/right-side position. This is an enhancement to the existing
application, not a request to build a new website.

The objective is to help iPlanet CEC executives quickly identify the
correct store discounts and eligible bank offers for a selected Apple
device.

## 2. Home Page Layout and Design

Position both offer panels vertically on the **left side of the Home
Page**:

-   **Top-left:** Store Offers
-   **Bottom-left:** Bank Offers
-   **Centre/right:** Existing Store Locator, results and map

Preserve the current website layout, dark theme, iPlanet branding,
navigation and functionality.

### Diwali visual treatment

Apply the Diwali festive theme **only to the two offer panels**.

Use tasteful festive details such as: - Subtle diya illustrations or
decorative lamps - Warm golden lighting and accents - Restrained festive
patterns or sparkles - A premium, professional card design consistent
with iPlanet branding

Do **not** apply Diwali decorations or a festive background to: - The
overall Home Page - The Store Locator - Store results or maps - The View
Stock section - Other application panels

Keep all offer text clear and readable. Add a **DIWALI SPECIAL** label
to both panels while the Diwali campaign is active.

## 3. One Common Device Search

Create one shared device search and selection mechanism for both offer
panels.

The selected device must automatically filter and refresh **both**
panels.

Example: - The executive selects **iPhone 17 Pro -- 256GB**. - The Store
Offers panel displays the applicable iPhone store discounts. - The Bank
Offers panel displays the bank offers eligible for that product and
variant.

If the executive changes the selection to **MacBook Neo -- 512GB**, both
panels must immediately refresh with the relevant MacBook offers.

Requirements: - Use one common device search, not separate search fields
in each offer panel. - Support product search by device name, model and
variant/storage where available. - Update both panels immediately when
the selected device changes. - Provide a clear empty state if no
applicable offer is found. - Keep the selected product consistent with
the existing View Stock functionality.

### View Stock integration

When a device is selected through View Stock, update the shared
selected-device state and refresh both offer panels.

When a device is selected through the Home Page common search, keep the
product selection consistent with View Stock wherever the existing
application supports it.

Do not break or replace the existing stock lookup workflow.

## 4. Store Offers -- Product-Based Offer Engine

Connect the Store Offers panel to a separate **iPlanet Store Offers
master sheet**.

Automatically identify and display offers applicable to the selected
product and variant.

### Product-wise offer rules

#### iPhone

Display the two applicable offer variations separately:

1.  Store Discount -- With Exchange
2.  Store Discount -- Without Exchange

Show the store discount amount for each variation. If an exchange
benefit is available, display it separately from the store discount. Do
not assume or invent an exchange value.

#### MacBook

Display applicable: - Student discount - Corporate discount - CRT
discount - Standard store discount, where applicable

#### iPad

Display applicable: - Student discount - Corporate discount - CRT
discount - Standard store discount, where applicable

#### Other Apple devices

For Apple Watch, AirPods, accessories and other supported devices,
display the applicable standard store discount.

Do not apply iPhone exchange rules or Mac/iPad CRT rules to unrelated
products.

### Store offer details

Where available, display: - Product name and model/variant - Storage -
Offer category - Exchange requirement - Store discount amount -
Additional benefits - Customer eligibility - Offer validity - Terms and
conditions

If no applicable offer exists, display:

> No active store offer available for this product.

## 5. Bank Offers -- Credit Card Offer Engine

Connect the Bank Offers panel to a separate **iPlanet Credit Card Offers
master sheet**.

Automatically filter bank offers based on the selected product,
model/variant and eligibility conditions.

Banks may include: - ICICI Bank - SBI - Axis Bank - HDFC Bank - Other
banks included in the approved master sheet

### Bank offer details

Where available, display: - Bank name - Card type - Eligible
product/category - Offer type - Instant cashback amount or percentage -
Minimum transaction amount - Maximum cashback - EMI or non-EMI
condition - Offer validity - Terms and conditions

Only display offers that are eligible for the selected product and
transaction conditions.

If no eligible bank offer exists, display:

> No active bank offer available for this product.

Do not imply that a bank offer applies to every Apple product or every
card variant.

## 6. Automatic Filtering -- Both Panels Together

Both panels must use the same selected device.

Example: **Selected device -- iPhone 17 Pro 256GB**

**TOP-LEFT -- Store Offers** - With Exchange: applicable store
discount - Without Exchange: applicable store discount

**BOTTOM-LEFT -- Bank Offers** - ICICI: eligible offer, if available -
SBI: eligible offer, if available - Axis: eligible offer, if available -
Other banks: eligible offers from the master sheet

When the device changes, both panels must refresh automatically without
requiring a second search or a page reload.

If the product variant is not matched confidently, ask the executive to
select or confirm the correct variant rather than guessing.

## 7. Optional Final Price Calculator

Provide a calculator using only verified, eligible and combinable
benefits.

Calculation:

**Product MRP**\
− Applicable store discount\
− Eligible bank cashback\
= **Effective price**

Example (illustrative only):

-   Product MRP: ₹82,900
-   Store discount: ₹5,000
-   Eligible bank cashback: ₹3,000
-   Effective price: ₹74,900

Exchange value is not included in this example.

Important calculation rules: - Do not double-count any discount. - Do
not subtract an exchange value unless the customer has an eligible
exchange quotation. - Clearly distinguish an instant discount from
cashback credited later. - Show EMI-related benefits separately. -
Follow the offer-combination rules in the master sheet. - Never combine
offers marked as non-combinable. - Clearly label the result as an
effective price and show the calculation breakdown.

## 8. Master Sheet Structure

Maintain two independent offer master sheets so each can be updated
without changing the other.

### Sheet 1 -- Store Offers

Recommended columns:

  -----------------------------------------------------------------------
  Column                              Description
  ----------------------------------- -----------------------------------
  Offer ID                            Unique offer identifier

  Product Category                    iPhone, Mac, iPad, Watch, AirPods,
                                      Accessories, etc.

  Product Name                        Product name

  Model / Variant                     Exact model or variant

  Storage                             Storage capacity, where applicable

  Offer Type                          Store discount, Student, Corporate,
                                      CRT, etc.

  Exchange Required                   With exchange / Without exchange /
                                      Not applicable

  Store Discount                      Approved discount amount or
                                      percentage

  Customer Category                   General, Student, Corporate, etc.

  Eligibility                         Conditions the customer must meet

  Combinable                          Whether the offer can be combined
                                      with other benefits

  Valid From                          Offer start date

  Valid Until                         Offer end date

  Terms and Conditions                Full offer conditions or reference

  Status                              Active / Inactive
  -----------------------------------------------------------------------

### Sheet 2 -- Bank Offers

Recommended columns:

  -----------------------------------------------------------------------
  Column                              Description
  ----------------------------------- -----------------------------------
  Offer ID                            Unique offer identifier

  Bank Name                           Bank providing the offer

  Product Category                    Eligible product category

  Product Name                        Eligible product

  Model / Variant                     Eligible model or variant, if
                                      restricted

  Card Type                           Credit card type

  Offer Type                          Instant cashback, EMI offer, etc.

  Cashback Amount / Percentage        Approved benefit

  Minimum Transaction                 Minimum purchase value

  Maximum Cashback                    Cashback cap

  EMI / Non-EMI                       Applicable transaction type

  Combinable                          Whether it can be combined with
                                      store offers or other benefits

  Valid From                          Offer start date

  Valid Until                         Offer end date

  Terms and Conditions                Full offer conditions or reference

  Status                              Active / Inactive
  -----------------------------------------------------------------------

Use the actual approved offer data as the source of truth. Do not
populate production offers with illustrative examples.

## 9. Offer Data Updates and Administration

Provide a straightforward way for authorized administrators to update
each master sheet independently.

Requirements: - Refresh the offer data from the configured source. -
Display the last successful data refresh date/time. - Validate required
fields and date formats. - Handle missing or unavailable data clearly. -
Do not silently continue showing expired or stale offers as current. -
Keep a clear distinction between an offer being unavailable and the data
source failing to load.

Do not assume a Google Sheets connection, API, credentials or file
location already exists. Reuse an existing configured integration if
available; otherwise identify the required configuration before
implementation.

## 10. Diwali Campaign Validity

The Diwali appearance and the validity of the offers must be handled
separately.

While the Diwali campaign is active: - Show the **DIWALI SPECIAL** label
on both offer panels. - Apply the festive styling only to those
panels. - Display only offers whose validity and eligibility conditions
are satisfied.

After the Diwali campaign ends: - Automatically remove the
Diwali-specific label and decorations. - Restore the regular offer-panel
appearance. - Continue showing other active regular offers, if
available.

Use an explicit campaign start and end date configured by an
administrator. Do not infer the campaign period from an offer name or
the current date.

An expired offer must never remain visible as an active offer, even if
the Diwali visual theme is still enabled.

## 11. Integration With the Existing Application

This is an enhancement to the existing iPlanet AI Store Locator.
Preserve all existing working features, including: - Existing Home Page
and navigation - PIN code, area, locality, city and landmark search -
Authorized iPlanet retail store results - POS/internal store codes -
Google Maps integration - Existing View Stock feature - Existing
database and data connections - Responsive layout and current branding

Add the two offer panels to the existing left-side area without removing
or rewriting unrelated functionality.

Ensure the layout remains usable on smaller screens. On narrow screens,
stack the offer panels in a sensible order without hiding the Store
Locator or its controls.

## 12. Accuracy, Validation and Error Handling

-   Never invent offer amounts, eligibility or terms.
-   Never show expired or inactive offers as available.
-   Never assume a bank offer applies to all products or card types.
-   Never combine offers marked as non-combinable.
-   Do not guess when the selected product or variant is ambiguous.
-   If offer data is unavailable, show a clear message and do not
    substitute sample data.
-   Distinguish "no eligible offer" from "unable to load offer data."
-   Display the last updated time for the offer data.
-   Use Indian currency formatting (₹).
-   Ensure all displayed amounts and calculations are traceable to the
    approved offer data.

## 13. Acceptance Criteria

The implementation is complete when all of the following work:

1.  Both offer panels appear on the existing Home Page.
2.  Store Offers is positioned at the top-left.
3.  Bank Offers is positioned at the bottom-left.
4.  Only the two offer panels receive the Diwali festive design.
5.  One common device search controls both panels.
6.  Selecting a device refreshes both panels automatically.
7.  Changing the selected device refreshes both panels again.
8.  iPhone exchange and non-exchange offers are displayed separately.
9.  Mac and iPad Student, Corporate and CRT offers are filtered
    correctly.
10. Other devices show their applicable standard store discounts.
11. Bank offers are filtered by product and their eligibility
    conditions.
12. Expired and inactive offers are not shown as active.
13. The View Stock product selection stays synchronized with the offer
    panels.
14. The optional price calculator follows the approved offer-combination
    rules.
15. The Diwali theme automatically returns to the regular appearance
    after the configured campaign period.
16. Existing Store Locator, map, stock and navigation features continue
    to work.

## 14. Final Expected Experience

An iPlanet CEC executive should be able to:

1.  Open the existing iPlanet AI Store Locator Home Page.
2.  Select a product using one common device search.
3.  Immediately see applicable Store Offers in the top-left panel.
4.  Immediately see eligible Bank Offers in the bottom-left panel.
5.  Change the device and see both panels update automatically.
6.  Use the existing View Stock functionality without losing
    product-selection consistency.
7.  Calculate the effective customer price using only eligible and
    combinable benefits.
8.  Explain accurate offer details and conditions to the customer.

### Core Concept

**ONE DEVICE SEARCH → TWO AUTOMATIC OFFER PANELS → COMPLETE CUSTOMER
OFFER INFORMATION**

Build this as a reliable, fast and easy-to-use enhancement for daily
iPlanet CEC operations.

**Implementation instruction:** First inspect the existing project
structure and identify the current Home Page, shared product-selection
state, View Stock workflow and data connections. Then make the smallest
necessary changes. Do not rebuild the website from scratch, replace
working features, or assume that offer-sheet integrations already exist.
Explain any required configuration before treating the feature as
connected to live offer data.
