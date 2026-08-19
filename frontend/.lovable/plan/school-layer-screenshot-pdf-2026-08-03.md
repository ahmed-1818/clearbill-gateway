# School Layer Screenshot PDF

Package the 8 captured School-layer screens into a single 8-page PDF for sharing.

## Output

`school-screens/clearbill-school-suite.pdf` — one screen per page, in this order:

1. Overview
2. Branches
3. Students
4. Fee Structures
5. Payments
6. Reminders
7. Settings
8. Parent Portal (mobile width)

## Page design

- A4 landscape pages so the 1280x1800 desktop captures stay legible; each image is scaled to fit with a small white margin.
- The narrow mobile parent-portal capture (480x1000) is centred on its page rather than stretched.
- A small caption with the page name at the bottom of each page.

## Technical notes

- Generated with a Python script (Pillow + reportlab) reading from `/mnt/documents/school-screens/`.
- Every page is rendered back to an image and visually inspected before delivery to catch clipping, stretching, or blank pages.
- No application source files change.
