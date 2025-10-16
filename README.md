# School Kaart — Excel Upload (GitHub Pages)

Upload een Excel- of CSV-bestand met drie kolommen — **Naam van de School**, **Longitude**, **Latitude** — en plot de punten direct op een Leaflet-kaart.

## Belangrijk
- Je kunt **komma (,) of punt (.)** als decimaalteken gebruiken bij coördinaten.
- CSV met **;** als scheidingsteken wordt ook herkend (basic). Voor complexere CSV: gebruik `.xlsx`.

## Snel starten
1. Maak een nieuwe GitHub repository aan (bijv. `school-map-uploader`).
2. Upload alle bestanden in de `main` branch.
3. Ga naar **Settings → Pages** en kies **Deploy from a branch**, branch = `main`, folder = `/ (root)`.
4. Open de gegenereerde URL en upload je eigen bestand.

## Kolomnamen (exact)
- `Naam van de School`
- `Longitude`
- `Latitude`

## Privacy
Alle verwerking gebeurt in de browser. Er worden geen bestanden geüpload naar een server.

## Licentie
MIT


## Flexibele kolomnamen
De app herkent veelvoorkomende varianten (hoofdletterongevoelig):
- Naam: `Naam van de School`, `NAAM SCHOOL`, `Naam school`, `Schoolnaam`, `Naam`
- Latitude: `Latitude`, `LATITUDE`, `Breedtegraad`, `Lat`, `Y`
- Longitude: `Longitude`, `LONGITUDE`, `Lengtegraad`, `Lon`, `X`

Als een naamkolom ontbreekt, wordt een fallback-naam gebruikt (bijv. "Locatie 1").
