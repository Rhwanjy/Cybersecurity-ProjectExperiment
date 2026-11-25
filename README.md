# Cybersecurity-Project
An English/Arabic cybersecurity audit checklist for an EgyptAir class role-play.

## Publish

Upload `index.html`, `style.css`, `app.js`, and the `data/` folder to the root of the repository on `main`. In **Settings → Pages**, choose **Deploy from a branch**, then **main / (root)** and **Save**. Open the URL shown in Pages after deployment.

## Maintain the checklist

Edit `data/checklist.json` to change the shared bilingual starter checklist. Each item has one stable ID, English and Arabic fields, a risk level, a deadline in days (0 means immediate), and a standards reference. Use unique IDs. Set a reference's excerpt status to `verified`, `paraphrase`, or `unverified`.

Each item points to a domain with `domainKey`. Domains live in `data/domains.json` (key, English and Arabic name, one-line description); their order sets the section order and gate letters, and a domain with no items shows no chip or section. An item whose key matches no domain appears under **Other**. The domain chips are multi-select, and the metrics and Gap Register always cover the whole checklist.

The browser storage key is versioned (`egyptair-audit-v2`). Raise the number whenever the starter data changes shape so browsers reload it.

The app seeds each browser from that file on first use. Edits, deletions, review progress, comments, and gap findings are saved in that browser and do not write back to GitHub. Use a fresh browser profile to load updated starter data without overwriting your current session. Enter only simulated information during the class audit.

## Workflow

Record the outcome and mark reviewed independently. The gap register sorts by risk, then deadline. A corrected outcome removes the finding from the active register while retaining its draft description.
