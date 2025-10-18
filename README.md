
## Zelf de heatmap-schaal bepalen
Voeg twee (optionele) kolommen toe (hoofdletterongevoelig):
- `SCHAAL_MIN` — ondergrens van de schaal (bijv. 0)
- `SCHAAL_MAX` — bovengrens van de schaal (bijv. 50)

De app gebruikt de **eerste niet-lege numerieke waarde** in deze kolommen als schaal. Als je ze weglaat, wordt de schaal automatisch bepaald.

**Excel-indeling (voorbeeldkolommen):**
| NAAM SCHOOL | LONGITUDE | LATITUDE | 2022/2023 | 2023/2024 | 2024/2025 | 2025/2026 | SCHAAL_MIN | SCHAAL_MAX |
|---|---|---|---:|---:|---:|---:|---:|---:|
| OBS De Start | 4,8952 | 52,3702 | 10 | 12 | 8  | 6  | 0 | 30 |
| CBS De Wissel | 5,7999 | 53,2012 | 5  | 0  | 14 | 9  |   |    |
| RSG Noorderhoek | 6,5665 | 53,2194 | 0  | 0  | 0  | 20 |   |    |
| CSG Comenius | 5,1234 | 52,2345 | 18 | 22 | 30 | 5  |   |    |

> **Werking:** Intensiteit = (waarde - SCHAAL_MIN) / (SCHAAL_MAX - SCHAAL_MIN), begrensd tussen 0 en 1.
