# Dog Duty

A small shared calendar for covering dog care while the owner is away. Each day has four
slots (Morning, Midday, Evening, Overnight). Anyone with the link can claim, reassign or
release a slot and leave a note for the day. Changes show up live for everyone.

Static site (GitHub Pages) + Supabase for data. No build step, no logins — people type
their name once and the browser remembers it.

## Setup

1. **Supabase**
   - Create a free project at <https://supabase.com>.
   - Open **SQL Editor**, paste in `supabase/schema.sql`, and run it.
   - Go to **Project Settings → API** and copy the Project URL and the `anon` public key.
2. **Configure** — edit `config.js`:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`
   - `TRIP_START`, `TRIP_END` (inclusive, `YYYY-MM-DD`)
3. **Try it locally**
   ```sh
   python3 -m http.server 8000
   # open http://localhost:8000
   ```
4. **Publish on GitHub Pages**
   ```sh
   git init && git add . && git commit -m "Dog Duty"
   gh repo create dog-duty --public --source . --push
   gh api -X POST repos/{owner}/dog-duty/pages -f 'source[branch]=main' -f 'source[path]=/'
   ```
   The site appears at `https://<your-user>.github.io/dog-duty/` after a minute or so.

## Notes

- **Open access.** Anyone who has the link can edit the schedule. The anon key only
  reaches the `claims` and `day_notes` tables.
- **Free-tier pausing.** Supabase pauses free projects after about a week with no
  activity. If you set this up well before the trip, open it now and then, or restore the
  project from the Supabase dashboard.
- **Changing slots.** Slot keys live in both `config.js` and the check constraint in
  `supabase/schema.sql`; change them together.
- **Resetting after a trip.** In the SQL editor: `truncate claims, day_notes;`
