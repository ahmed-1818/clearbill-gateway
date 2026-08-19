# ClearBill Gateway

Act as an elite UI/UX Lead Engineer and Senior Full-Stack Architect specializing in high-end, institutional financial software (like Stripe, Mercury, or corporate banking apps). Build a complete, interactive, mobile-first Web Application called "ClearBill" using React, Tailwind CSS, shadcn/ui components, and Lucide React icons.



The application must be fully functional locally using React state (useState, useEffect) so that modals open, forms update tables, and navigation works. Do not use generic dummy text (Lorem Ipsum)—use realistic Pakistani business data.



### I. GLOBAL DESIGN SYSTEM & TOKENS

1. Color Architecture:

   - Canvas/Background: Soft, ultra-light cool slate (#fafbfd) for dashboards; pure white (#ffffff) for cards.

   - Text & Core Brand: Deep Institutional Slate Charcoal (#0f172a).

   - Accents: Corporate Blue (#3b82f6) for primary actions and active states.

   - Status Badges: Muted Sage Green for [PAID] (#d1fae5 background, #065f46 text), Muted Slate Rose for [UNPAID] (#ffe4e6 background, #9f1239 text).

2. Geometry & Typography:

   - Crisp, engineered border-radius (strictly `rounded-md` or `rounded-lg`).

   - Sharp, highly readable sans-serif typeface (Inter/system-default).

   - Minimalist table borders (divider lines only, no heavy grid boxes).



### II. ARCHITECTURE & ROUTING

Simulate a Next.js App Router experience using local state routing. The app must have 3 distinct domains.



#### DOMAIN 1: THE GATEWAY (Route: /)

- A clean, high-end Welcome/Landing Page.

- Header: Minimalist typographic logo: "ClearBill".

- Layout: A vertically centered container asking "Select your institutional workspace."

- Two massive, premium selection cards with hover effects:

  1. [ Gym & Fitness Management ] -> Routes to Gym Hub. Include a dumbbell icon.

  2. [ School & Academic Billing ] -> Routes to School Hub. Include a graduation cap icon.



#### DOMAIN 2: THE GYM LEDGER (Route: /app/gym)

- Dashboard View (/app/gym/dashboard):

  * Top Nav: Shows "Johar Town Iron Gym", a user profile avatar, and a "Switch Workspace" button.

  * Metrics Header: Two sleek summary cards side-by-side: "Total Collected (Rs. 180,000)" and "Total Outstanding (Rs. 40,000)".

  * Settings Drawer (Manage Packages): A section to create reusable packages. Needs inputs for [Package Name], [Fee Amount (Rs)], and a Dropdown for [Duration] (Options: 1 Month (30 days), 3 Months (90 days), 6 Months (180 days), 7 Days). Display a list of saved packages.

  * Ledger Table: Columns -> Member Name, Phone, Package Name, Expiry Date, Status Badge, and Action.

  * Action Buttons: Replace the "Portal" button with a Lucide 'Link' icon button. Clicking it triggers a shadcn `Toast` notification saying "Payment Link Copied to Clipboard".

  * Add Member Modal: Inputs -> Full Name, WhatsApp Number. A radio-group to select a pre-made package.

  * **CRITICAL DATE LOGIC:** When a pre-made package is selected, dynamically calculate the "Expiry Date" based on the package's duration (e.g., if "3 Months" is selected, add 90 days to today's date) and display it in a read-only input field before the user clicks Submit. Clicking Submit adds them to the Ledger Table.



- Client Payment Portal (/app/gym/pay/[id]):

  * CRITICAL SECURITY: Hide the global Top Nav completely. The client must only see the business logo and the payment card.

  * Bill Summary Section: "Billed to: Ahmed Raza", "Package: 3 Months", "Due: Rs. 15,000", "Expiry: 12 Aug 2026".

  * The Fintech Biller UI: REMOVE image upload functionality. Create a "Bank Transfer / 1Link" payment box. 

  * Inside the box, display a massive, highly visible "Consumer ID: 999999-03214261066". Add a small "Copy" icon next to it.

  * Add instructional text: "Log into your banking app (Meezan, HBL, Nayapay), select Bill Payment -> KuickPay, and enter this Consumer ID to pay instantly."

  * Add a primary, full-width button at the bottom: "Pay via Safepay (Debit/Credit Card)" that acts as a mock redirect.



#### DOMAIN 3: THE SCHOOL LEDGER (Route: /app/school)

- Dashboard View (/app/school/dashboard):

  * Top Nav: Shows "Beaconhouse Johar Town".

  * Metrics Header: Same UI as Gym, but with academic numbers (e.g., "Total Collected (Rs. 1,450,000)").

  * Ledger Table: Optimized for academics. Columns -> Student Name, Parent WhatsApp, Class/Grade (e.g., "Class 8 - Section A"), Roll No, Due Fee, Status Badge, Action (Copy Link).

  * Add Student Modal: Inputs -> Student Name, Parent WhatsApp, Dropdown for Class (Class 1 to 10), and Monthly Tuition Fee (Rs).



- Parent Payment Portal (/app/school/pay/[id]):

  * CRITICAL SECURITY: No global admin nav.

  * Bill Summary Section: "Student: Ali Khan", "Class: 8-A", "Fee Period: July 2026", "Due: Rs. 12,000".

  * The Fintech Biller UI: Identical to the Gym's 1Link/KuickPay Consumer ID and Safepay checkout layout, but branded for the school's fee collection.



### III. TECHNICAL EXECUTION RULES

1. Use `lucide-react` for all iconography.

2. Use shadcn/ui components (`Card`, `Button`, `Input`, `Dialog`, `Select`, `Table`, `Badge`, `useToast`).

3. Ensure absolute mobile responsiveness. Tables must scroll horizontally on small screens without breaking the layout.

4. Add subtle hover states 

(`hover:bg-slate-50`) to all table rows and clickable cards.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c9fb9918-d615-45a3-ba33-eb50be4eb183).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
