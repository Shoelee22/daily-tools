# Daily Tools — 10 real-life products for India

Full working web products for everyday needs — billing counters, clinics,
landlords, farmers, elderly care. Open `index.html` and pick one.

No build step, no npm, no sign-ups, no external network calls.
Your data stays in your browser's localStorage.

| # | Product | What it does |
|---|---------|--------------|
| 01 | [Dukaandaar POS](dukaandaar-pos/) | Counter billing with GST, inventory, printable invoices & sales reports for kirana/pharmacy shops |
| 02 | [ClinicDesk](clinicdesk/) | Patient registry, visit history, prescriptions & follow-up reminders for small clinics |
| 03 | [SevaDesk](sevadesk/) | Job-card kanban, technician dispatch & AMC reminders for repair/service businesses |
| 04 | [GharSeva](gharseva/) | Book electricians/plumbers/carpenters; track jobs, rate pros |
| 05 | [Kiraya](kiraya/) | Rent schedules, digital receipts, defaulter tracking & tenant ledgers for landlords |
| 06 | [MotoLog](motolog/) | RC/insurance/PUC expiry alerts, fuel mileage log & service history for vehicles |
| 07 | [Beesi](beesi/) | Chit-fund/kitty manager — collections, payout rotation, defaulters |
| 08 | [Mohalla](mohalla/) | Neighbourhood board — notices, buy & sell, borrow, lost & found |
| 09 | [Parivar Care](parivar-care/) | Daily check-ins, medicine reminders & SOS for elderly parents |
| 10 | [KisanSetu](kisansetu/) | Mandi prices, farm expenses & scheme deadlines for farmers |

## Run locally

```bash
cd daily-tools && python3 -m http.server 8000
# open http://localhost:8000/
```

Each product also has a `?selftest=1` mode that runs its full automated
verification suite in the browser.

## Design

Every product has its own visual identity, guided by brand design-system
references (adapted, not copied): Airtable, Oura, Linear, Airbnb, Mercury,
BMW M, Mastercard, Pinterest, Apple, Starbucks — layered on dashboard-grade
UI standards. Vanilla HTML/CSS/JS with system fonts throughout.
