# School Kaart — Excel Upload (GitHub Pages)

Upload een Excel- of CSV-bestand met **Naam**, **Longitude**, **Latitude** en (optioneel) vier jaar-kolommen — `2022/2023`, `2023/2024`, `2024/2025`, `2025/2026`.
De kaart toont pins voor rijen waar in ten minste één van de **geselecteerde jaren** de waarde **JA** is.

## Gebruik
1. Open de site en upload je Excel (`.xlsx`) of CSV.
2. Open **Jaren filteren** en vink één of meerdere schooljaren aan.
3. Klik **Toepassen**. Alleen rijen met **JA** onder de geselecteerde jaren worden getoond.
4. Klik op een pin om de schoolnaam te zien.

## Kolommen
- Naam: flexibele koppen, o.a. `NAAM SCHOOL`, `Naam van de School`, `Schoolnaam`, `Naam`.
- Latitude / Longitude: flexibele koppen en komma/punt als decimaal.
- Jaren (exacte koppen): `2022/2023`, `2023/2024`, `2024/2025`, `2025/2026` met waarden **JA** of **NEE**.

## CSV
Puntkomma-gescheiden CSV wordt basic ondersteund. Voor complexere CSV, gebruik bij voorkeur `.xlsx`.

## Privacy
Alle verwerking gebeurt in de browser (client-side).

## Licentie
MIT
