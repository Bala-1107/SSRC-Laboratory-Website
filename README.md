# SSRC Quotation Generator

A client-side React + Vite + TypeScript web app that fills the official SSRC Laboratory quotation PDF.

```
FORM → LIVE CALCULATION → PDF PREVIEW → DOWNLOAD PDF / SHARE PDF
```

The quotation is **not** recreated in HTML. The app loads the original, unmodified template
(`public/quotation-template.pdf`) with **pdf-lib** and draws only the dynamic values onto it, so
the output is a real PDF with selectable text. The logo, fonts, table, terms, signature and footer
all come from the template. No backend is needed, and everything runs in the browser.

## Requirements

- Node.js 18 or newer (tested with Node 22)
- npm 9 or newer

## Install, run, build

```bash
npm install        # install dependencies
npm run dev        # dev server → http://localhost:5173
npm run build      # type-check + production build → dist/
npm run preview    # serve the production build locally → http://localhost:4173
npm run sample     # (optional) generate the acceptance-test PDF into sample-output/
```

`dist/` is a static site. Upload it to any static host (Netlify, Vercel, GitHub Pages, cPanel,
nginx, etc.). It uses relative paths (`base: './'`), so it also works from a sub-folder.

> **Use HTTPS in production.** Browsers only enable the Web Share API (Share PDF) on secure
> origins. `localhost` also counts as secure.

## Using the app

1. **Quotation Details.** Enter only the number (e.g. `123`). The PDF shows `SSRC/SPT/123/2026-27`.
   If someone pastes a full `SSRC/SPT/…/2026-27` number, the prefix and suffix are stripped, so
   they can never be duplicated.
2. **Client Details.** Name, Place and Subject Place are three independent fields.
3. **Bill of Quantities.** Enter a quantity and rate for each of the two fixed items. Amounts,
   total, GST (fixed at 18%) and grand total update as you type.
4. **Additional Drilling Rates.** Three rates that are printed into Terms 1–3 after the existing ₹.
5. **Preview Quotation** validates the form and generates the real PDF, then renders it.
   **Download PDF** saves `SSRC-SPT-{number}-{yyyy-mm-dd}.pdf`. It is byte-for-byte the previewed
   PDF, because the preview is reused when nothing has changed. **Share PDF** opens the phone's or
   computer's share sheet (WhatsApp, email, …) where the browser supports sharing files. Otherwise
   it downloads the PDF and explains why. **Reset Form** clears everything.

## How the values are placed

### The coordinate map (`src/pdf/pdfCoordinates.ts`)

All PDF positions live in **one file**. Each entry records its x/baseline y, alignment, font, size,
maximum right edge and the template anchor it was measured from.

- Units are PDF points, with the origin at the **bottom-left**, the same system pdf-lib uses. No
  screen-pixel conversion is involved, so the output is identical on every device.
- Anchors were read from the template's own content stream (the exact position of every text run
  Word wrote), not estimated from an image.
- Style and relative offsets come from the completed reference quotation (Q119 Arakkonam): Name and
  Place are indented 19 pt under "To," with 15.24 pt line spacing, the date sits 3.3 pt after
  "Date:", each value follows "Rs." after one space, and "/-" is added after amounts.
- **Note:** the reference was made from an older layout. Everything in it sits about 13 pt lower,
  and it has 4 terms instead of 6. So only its relative placement and style were used; the
  absolute anchors are the empty template's.

### The "Rs." / "₹" rule

The template already contains `Rs.` and `₹`, so the app draws **numbers only**
(e.g. `15,000/-` next to the existing `Rs.`). The currency symbol is never duplicated.

### Narrow blanks ("make room")

Some blanks in the template are narrower than the values that go in them. For example, the ₹ blank
in Term 1 is only 13.8 pt wide, while "180" needs about 16.6 pt plus spacing. Word positions each
text run separately, so the app moves only the runs that follow the blank **on that one line**
(e.g. `+ 18% GST per`) right by exactly the space needed. Their wording, font and weight are
untouched, and they stay fully visible. Nothing is covered or removed. The same mechanism makes the
quotation number read as one unbroken string (`SSRC/SPT/123/2026-27`), as in the reference.

If a future template doesn't have those runs, the value is shrunk to fit the original blank
instead. Any value too wide for its cell (e.g. ₹12,50,000) is also shrunk slightly to stay inside
the table borders.

### Replacing or calibrating the template

1. Replace `public/quotation-template.pdf`. Keep the name.
2. Run `npm run sample` and open `sample-output/SSRC-SPT-123-2026-09-28.pdf`.
3. If anything is off, adjust `x` / `y` for that field in `src/pdf/pdfCoordinates.ts`.
   To find new anchors, use `pdftotext -bbox quotation-template.pdf out.html` (poppler-utils).
   Baseline y ≈ page height − bottom-of-word + about 2.4 pt.

Other settings in the same file:

- `suffix` controls the punctuation added after Name/Place/Subject Place (`,` `.` `.`, as in the
  reference). Set it to `undefined` to remove it.
- `font` sets regular or bold per field. Totals and the Term 1–2 rates are bold, as in the reference.

## Project structure

```
public/
  quotation-template.pdf      ← master template (never modified)
src/
  components/
    QuotationForm.tsx         form sections and fields
    FormSection.tsx           card wrapper
    Field.tsx                 accessible input with keystroke filtering
    CalculationSummary.tsx    live totals
    PreviewPanel.tsx          renders the generated PDF (pdf.js, with iframe fallback)
    ActionButtons.tsx         Preview / Download / Share / Reset
  pdf/
    generateQuotationPdf.ts   generateQuotationPdf(formData) → { bytes, blob, fileName }
    pdfCoordinates.ts         ★ the central coordinate map
    pdfUtils.ts               fit-to-width and run-shifting helpers
  utils/
    calculations.ts           amounts, total, GST 18%, grand total (integer-paise maths)
    formatting.ts             Indian number format, dates, quotation no., file name
    validation.ts             required fields and number rules
  types/quotation.ts
  App.tsx · main.tsx · styles.css
scripts/generate-sample.ts    acceptance test (same code path as the app)
```

## Business rules (fixed)

| Rule | Value |
|---|---|
| Item amount | Quantity × Rate |
| Total | Item 1 + Item 2 |
| GST | 18% of Total (not editable) |
| Grand Total | Total + GST |
| Units | Item 1 = LS, Item 2 = Per Point |

Money maths is done in whole paise to avoid floating-point errors. Whole-rupee amounts print as
`3,000/-`; amounts with paise print as `1,234.50`.

## Validation

All 12 inputs are required. Quantity must be greater than 0. Rates must be 0 or more (invalid
characters can't be typed at all). Names and places must use characters the quotation's Times font
can print (English letters, digits and punctuation). No PDF is generated while any field is
invalid, and the first invalid field is scrolled into view and focused.

## Preview notes

The preview renders the **actual generated PDF bytes** with pdf.js, which loads on first use. This
is needed because Android Chrome cannot show PDFs inside an `<iframe>`. If pdf.js fails, the app
falls back to an `<iframe>` of the same PDF. **Open PDF** opens it in the browser's own viewer.
On iPhone, if the share sheet doesn't appear the first time (Safari requires the share to follow
the tap immediately), the app shows "tap Share PDF once more".

## Browser support

The app works in current Chrome, Edge, Firefox and Safari on desktop, and in Safari (iOS 15+) and
Chrome (Android) on phones. File sharing works on iOS Safari, Android Chrome, and desktop Safari,
Edge and Chrome (on Windows and ChromeOS). Elsewhere, Share falls back to Download.
