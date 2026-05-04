# Campaign Dashboard

Local use:

1. Keep the dashboard CSV files in [data](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/data).
2. Start the local server with `node server.js`.
3. Open [http://localhost:3010](http://localhost:3010).
4. After editing any CSV in `data/`, click `Refresh files` or refresh the page.

Files you can edit manually:

- [polestar_dashboard.csv](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/data/polestar_dashboard.csv)
- [hyundai_dashboard.csv](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/data/hyundai_dashboard.csv)
- [mitsubishi_dashboard.csv](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/data/mitsubishi_dashboard.csv)

Vercel deploy:

1. Upload this whole project folder to GitHub.
2. Import the repo into Vercel.
3. Deploy with the default static settings.
4. The site will read the published CSV sources listed in [data/manifest.json](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/data/manifest.json).

If you want the live site to update from Google Sheets:

1. Keep each Google Sheet published as CSV.
2. Update the published sheet data directly in Google Sheets.
3. Keep the URLs in `data/manifest.json` pointed at those published CSV links.

Main app files:

- [index.html](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/index.html)
- [app.js](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/app.js)
- [styles.css](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/styles.css)
- [server.js](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/server.js)
- [vercel.json](/Users/dianamakar/Documents/Codex/2026-05-04-files-mentioned-by-the-user-screenshot/vercel.json)
