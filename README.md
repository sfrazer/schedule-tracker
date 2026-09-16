# Dog Duty

A small shared calendar for covering dog care while the owner is away. Each day has four
slots (Morning, Midday, Evening, Overnight). Anyone with the link can claim, reassign or
release a slot and leave a note for the day. Changes show up live for everyone.

Static site (GitHub Pages) + Supabase for data. No build step, no logins — people type
their name once and the browser remembers it.

## Setup

1. **Supabase**
   - Create a free project at <https://supabase.com>.
   - Edit the `trip_window` dates in `supabase/schema.sql` to match your trip.
   - Open **SQL Editor**, paste in `supabase/schema.sql`, and run it.
   - Go to **Project Settings → API** and copy the Project URL and the `anon` public key.
2. **Configure** — edit `config.js`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `TRIP_START`, `TRIP_END` (inclusive, `YYYY-MM-DD`), the same dates as in `schema.sql`
3. **Try it locally**
   ```sh
   python3 -m http.server 8000
   # open http://localhost:8000
   ```
4. **Publish on GitHub Pages**
   ```sh
   git init && git add . && git commit -m "Schedule tracker"
   gh repo create schedule-tracker --public --source . --push
   gh api -X POST repos/{owner}/schedule-tracker/pages -f 'source[branch]=main' -f 'source[path]=/'
   ```
   The site appears at `https://<your-user>.github.io/schedule-tracker/` after a minute or so.

## Notes

- **Cache busting.** `index.html` loads `style.css`, `config.js` and `app.js` with a
  `?v=<hash>` of each file, so phones pick up changes instead of reusing old copies.
  A pre-commit hook updates those hashes; after cloning, run `scripts/install-hooks.sh`
  once (or run `scripts/stamp-assets.sh` by hand before committing).

- **Open access.** Anyone who has the link can edit the schedule. The anon key only
  reaches the `claims` and `day_notes` tables.
- **Free-tier pausing.** Supabase pauses free projects after about a week with no
  activity. If you set this up well before the trip, open it now and then, or restore the
  project from the Supabase dashboard.
- **Changing slots.** Slot keys live in both `config.js` and the check constraint in
  `supabase/schema.sql`; change them together.
- **Trip dates are enforced by the database.** Claims and notes outside the
  `trip_window` dates are rejected, so the dates in `config.js` and `schema.sql` must match.
- **New trip.** Update the dates in `config.js` and `supabase/schema.sql`, push, then in
  the SQL editor run `truncate claims, day_notes;` and re-run `schema.sql` (it's safe to
  run again).
- **New tables.** Anything you add in the SQL editor needs Row Level Security turned on,
  or the public key can read and write it.
