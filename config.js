// Fill these in from Supabase: Project Settings → API.
// The anon (public) key is meant to be shipped to browsers; it is safe to commit.
window.APP_CONFIG = {
  SUPABASE_URL: "https://vnbsbvlmeftdluodajdw.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_WA6S3XBhftPdtBeQ8KHzJA_Cmo9ahCf",

  // Trip dates, inclusive, as YYYY-MM-DD.
  // The database enforces these too: update trip_window in supabase/schema.sql to match.
  TRIP_START: "2026-10-19",
  TRIP_END: "2026-10-28",

  // Slot keys must match the check constraint in supabase/schema.sql.
  SLOTS: [
    { key: "morning", label: "Morning" },
    { key: "midday", label: "Midday" },
    { key: "evening", label: "Evening" },
    { key: "overnight", label: "Overnight" },
  ],
};
