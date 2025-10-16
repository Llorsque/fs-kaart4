# School Kaart — Excel Upload (GitHub Pages)

Een simpele statische webapp om een Excel-bestand te uploaden met drie kolommen — **Naam van de School**, **Longitude**, **Latitude** — en de punten direct te plotten op een Leaflet-kaart.

## Snel starten
1. Download deze repository als ZIP en pak hem uit.
2. Zet de map online met GitHub Pages:
   - Maak een nieuwe GitHub repository aan (bijv. `school-map-uploader`).
   - Upload **alle bestanden** uit deze map in de main-branch.
   - Ga naar **Settings → Pages** en kies **Deploy from a branch**, branch = `main`, folder = `/root`.
   - Wacht tot Pages live is. (URL: `https://<jouw-gebruikersnaam>.github.io/<repo-naam>/`)

## Gebruik
1. Open de GitHub Pages site.
2. Klik op **Bestand kiezen** en upload jouw Excel (`.xlsx`) of CSV.
3. Zorg dat de kolomnamen exact zijn:
   - `Naam van de School`
   - `Longitude`
   - `Latitude`
4. De pins worden geplaatst op basis van Longitude en Latitude. Klik op een pin voor de naam van de school.

> Tip: Gebruik decimale graden (bijv. lon `5.1214`, lat `52.0907`).

## Voorbeeldbestand
In deze repo staat `voorbeeld-scholen.xlsx` met 3 voorbeeld-locaties.

## Techniek
- **Leaflet** (OpenStreetMap tiles) voor de kaart.
- **SheetJS (xlsx)** voor het client-side parsen van Excel-bestanden.
- Alle dependencies via CDN, dus je hebt geen build-stap nodig.

## Privacy
Alle verwerking gebeurt in de browser. Er worden geen bestanden geüpload naar een server.

## Problemen?
- Zie je geen punten? Controleer kolomnamen en dat Longitude/Latitude numeriek zijn.
- Nederlandse komma’s in cijfers worden automatisch omgezet naar punten.
- CSV wordt basic ingelezen (gescheiden door komma). Voor complexere CSV gebruik `.xlsx`.

## Licentie
MIT
