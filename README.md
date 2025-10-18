# School Kaart — Excel Upload (Pins & Heatmap) — Stabiele versie

Upload een Excel- of CSV-bestand met **Naam**, **Longitude**, **Latitude** en (optioneel) vier jaar-kolommen — `2022/2023`, `2023/2024`, `2024/2025`, `2025/2026`.
Je kunt schakelen tussen **Pins** en **Heatmap**. De heatmap weegt per rij de **aantallen** in de **geselecteerde jaren** (JA=1). Schaal wordt automatisch bepaald o.b.v. de hoogste waarde.

## Gebruik
1. Upload je Excel (`.xlsx`) of CSV.
2. Kies één of meerdere schooljaren via **Jaren filteren** → **Toepassen**.
3. Wissel weergave: **Pins** of **Heatmap**.
4. Klik op een pin om de schoolnaam te zien.

## Kolommen
- Naam (flexibel): `NAAM SCHOOL`, `Naam van de School`, `Schoolnaam`, `Naam`.
- Coördinaten: flexibele koppen; komma/punt-decimaal oké.
- Jaren (exact): `2022/2023`, `2023/2024`, `2024/2025`, `2025/2026` → getal of JA/NEE.

## Privacy
Client-side; geen uploads naar een server.

## Publiceren op GitHub Pages
- Upload alle bestanden naar een repo (root) en activeer Pages via **Settings → Pages → Deploy from a branch**.

MIT
