# Rippling contractor export - recon notes

Recorded 2026-08-31 against a live logged-in contractor account.
No credentials or tokens are recorded here.

## Account shape

Contractor account, not employee. Landing route: `/contractor/dashboard`.
Nav: Dashboard, Money, Invoices, Time, Clients.

## Auth

All API calls are same-origin to `https://app.rippling.com/api/...` and require
headers taken from the live session:

| Header | Notes |
|---|---|
| `authorization` | `Bearer <token>` - session bearer, short lived |
| `company` | company object id |
| `role` | contractor role object id |
| `requestedaccesslevel` | `EE` |
| `device-fingerprint` | stable per browser profile |
| `login-agent` | `rippling-web` |

Playwright must capture these from a real logged-in page context rather than
reconstruct them.

## 1. Contractor invoices - SOLVED

List: `POST /api/global_contractors/api/v2/invoice/find_paginated?state__ne=DRAFT`

```json
{
  "paginationParams": {
    "page": 1,
    "perPage": 100,
    "sortingMetadata": {
      "columnIndex": 0, "order": "DESC", "columnId": "invoiceDate",
      "column": {"id":"invoiceDate","data":"invoiceDate","type":"date","sort":true}
    }
  },
  "pageSize": 100,
  "readPreference": "SECONDARY_PREFERRED",
  "access_level_override": "EE"
}
```

- `pageSize` is capped at 100; server rejects higher with a 400.
- Response: `{ data: [...], cursor, visibleRowCount, perPage }`.
- Paginate until `cursor` is null. Current account: 19 records, single page.

Useful record fields: `id` (24-char hex), `invoiceNumber` (e.g. `INV_03/10/2026_3`),
`invoiceDate`, `dueDate`, `state`, `invoiceAmount`, `contractName`, `clientName`,
`attachments[]`, `invoice`.

Download: the `invoice` field is a signed CloudFront URL -

`https://secured-assets.ripplingcdn.com/us1/global-contractors/{id}/global_contractors_invoice/pdfs/{id}-sensitive.pdf?Expires=&Signature=&Key-Pair-Id=`

Verified: HTTP 200, `application/pdf`, `%PDF-` magic bytes. All 19 records have one.
Signed URLs expire, so fetch them in the same run that lists them.

Attachments: 6 of 19 records carry exactly 1 attachment each. Shape:

```json
"attachments": [{ "url": "<signed url>", "type": "pdf" }]
```

Hosted on a *different* signed host from the invoice PDF itself:

`https://prod-images.rippling.com/{id}.pdf?Expires=&Signature=&Key-Pair-Id=`

Verified: HTTP 200, `application/pdf`, `%PDF-`. Every attachment in this account is
`type: "pdf"`, but the explicit `type` field implies other types are possible, so
derive the saved file extension from `type` rather than assuming `.pdf`.

Note: the row kebab menu offers only "Duplicate invoice" - there is no per-row
download in the UI. The detail drawer has "Download all documents" and renders the
PDF inline via react-pdf onto a canvas. Neither is needed; the API field is enough.

## 2. Pay stubs - SOLVED

List: `GET /api/international_payroll/get_pay_stubs/?roleId=<roleId>`

- Returns a plain JSON array of every pay stub, all years at once.
- The year dropdown in the UI filters client-side; there is no year query param.
- Current account: 18 records, all 2026.

Fields: `id` (24-char hex), `stubName` (e.g. `Mar 1, 2026 - Mar 15, 2026 - <entity>`),
`checkDate` (`YYYY-MM-DD`), `entityName`, `netPay`, `pdfFileForEE`, `isCorrected`,
`sourceApplication`.

Download: `pdfFileForEE`, a signed CloudFront URL -

`https://secured-assets.ripplingcdn.com/us1/international-payroll/{id}/international-payroll-processing/{id}-sensitive.pdf?Expires=&Signature=&Key-Pair-Id=`

Verified: HTTP 200, `application/pdf`, `%PDF-`. All 18 records have one.

Date filtering is client-side on `checkDate`.

## 3. Tax documents - NOT PRESENT (dropped from scope)

`/contractor/my-money/taxes` renders only a "Withholdings" section. No 1099 or
other year-end forms are available in this account, and no tax-document API call
is made when the tab loads.

Most likely because the account has no completed tax year yet (earliest activity
is March 2026). Deferred until a form actually appears; revisit at year end.

## Consequences for the design

1. No DOM scraping is required. Playwright is needed only to reach a logged-in
   page context and capture the session headers; all listing and downloading is
   plain HTTP against the JSON API.
2. Every PDF URL is signed with an `Expires` param. List and download must happen
   in the same run - URLs cannot be persisted between runs and reused.
3. Three distinct asset hosts are in play: `secured-assets.ripplingcdn.com` for
   invoices and pay stubs, `prod-images.rippling.com` for attachments.
