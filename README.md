# Momentum Coaching — Sprint Performance

A mobile-first training diary for coach Jamie Staff, Thalia and Njisane. Static HTML/CSS/JavaScript runs on GitHub Pages. Supabase provides private email/password accounts, Postgres persistence and database-enforced access rules. No build dependencies or paid browser libraries.

## Try it locally

Requires Python 3; Node 20+ for tests only.

```sh
cd momentum-coaching
python3 -m http.server 5173
```

Open http://localhost:5173 (do not double-click index.html; ES modules need HTTP). Choose a demo profile. The empty config enables a clearly labeled local demo with sample track, gym and trainer sessions for both athletes on the first launch date. Demo data persists in this browser's localStorage; profile switching is not authentication. Do not use the demo for private athlete data. To reset, remove only the `momentum-demo` localStorage entry in browser developer tools.

## What works

- Daily sessions, date navigation, preparation, objective and coaching cues.
- Track: total seconds, first split seconds, actual gear inches, peak watts, RPE and notes, per effort.
- Gym: load kg, reps, RPE and notes, per set. Trainer/recovery: duration minutes, average watts, RPE and notes. Prescribe intervals, target power, exercise, load and reps in effort instructions. This is manual logging, without trainer device pairing or ERG control.
- Athletes can read their own plans and save/update their own efforts. Jamie can view both athletes, edit/copy/delete plans and review recorded results. Use Refresh to fetch another person's latest changes.
- Coach session builder includes templates, individual effort instructions, recovery, comparison protocol and adjustable alert threshold. All templates are illustrative; review before prescribing.
- Interactive 42–70 tooth chainring × 12–22 tooth sprocket chart, closest target options, custom wheel diameter and rollout. Default 27-inch convention matches the supplied chart. Values are calculated, including correcting 47×18 to 70.50 inches. Chart choices are a reference; enter the selected inches in the plan/result explicitly. Wheel preference is stored on the device.

## Set up private accounts and persistence

1. Create a Supabase project you control. Run `supabase/schema.sql` once in its SQL Editor. The script is for a fresh database, not an idempotent migration.
2. In Authentication settings, disable public sign-ups. Create three email/password users using the dashboard's Add user/Create user flow and confirmed emails. Use the real email addresses for Jamie, Thalia and Njisane. Arrange passwords privately. The app uses password login; self-service registration and password recovery are not implemented. Use Supabase admin tooling for account recovery.
3. Copy each user's UUID from Authentication → Users. Run this SQL in the admin SQL Editor, replacing UUID placeholders with actual UUIDs:

```sql
insert into public.profiles (id,name,role) values
 ('JAMIE_AUTH_UUID','Jamie Staff','coach'),
 ('THALIA_AUTH_UUID','Thalia','athlete'),
 ('NJISANE_AUTH_UUID','Njisane','athlete');
```

4. Edit `config.js` with your project URL and legacy public **anon** API key from Supabase's API settings:

```js
export const config = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_PUBLIC_ANON_KEY'
};
```

The anon key is a public browser credential, protected by row level security. Never put a service_role or secret key in this file or GitHub. The REST adapter currently expects the legacy anon key. Production mode activates only when both fields are populated and never falls back to local data on network/auth failures. Demo records do not migrate into production.

5. Serve locally and sign in as Jamie. Create actual sessions for the appropriate athlete/date. Pick Gym/Trainer then use the selected type's template button to start with the corresponding fields. Review and save. Sign in as each athlete to enter results, then sign back in as Jamie and review them.

### Access architecture

`profiles` stores roles administered only through trusted database tooling. There is no public write policy on profiles, so clients cannot promote themselves to coach. `sessions` stores one athlete's daily prescription, including stable effort UUIDs in JSON. `results` stores one row per session/effort with a uniqueness constraint; saves upsert that row. Foreign keys, checks and triggers validate ownership, effort references, numeric ranges and splits.

All tables have RLS enabled; anonymous clients have no table privileges. Coach read policies cover both athletes. Athletes can select only their own profile, sessions and results; only coaches can mutate plans. Athletes can insert/update only their own result rows for their own prescribed efforts. Coaches review results without rewriting athlete submissions. Logged sessions retain their athlete, modality and effort protocol; copy them to make protocol changes. Title, cues, dates and alert thresholds remain editable. Deleting a session removes its results after an explicit confirmation; back up through Supabase before bulk changes.

Tokens live in sessionStorage (per browser tab/session), refresh before authenticated requests when near expiry, and are cleared locally on sign-out. Supabase access tokens remain valid until expiry; local sign-out does not revoke other devices. Live training data is held in memory and saved to Postgres, with no offline write queue. Save each effort before navigating; unsaved fields are not retained. Concurrent edits use last successful save; realtime subscriptions and conflict resolution are not included. Use Supabase backups/exports for recovery.

## Performance-loss rules

Each timed effort compares to the best valid matching effort earlier in the prescribed order **within the same session**. The matching key is protocol identifier + timing distance + start type + actual gear inches. Missing time, actual gear or protocol information yields no comparison. A new combination starts its own baseline. Improved times establish a new best; skipped rows do not count. Past days are not pooled.

`loss % = (current total time / best matching total time - 1) × 100`

For example, 10.00 s then 10.30 s at identical protocol/gear produces a 3.00% time increase. Changing gear resets the comparison group. This is time deterioration, not percentage speed loss. First splits are recorded but do not drive the alert. Use protocol names to distinguish track conditions, bike/setup, run-in, timing gates and any other relevant variation; the app cannot infer those factors. Use consistent gear-inch precision/convention. Protocols with missing timing distances never alert (e.g. gym/trainer).

The coach sets the threshold; blank disables alerts for fatigue-focused work. Alert only when the increase exceeds the threshold. The sample 2% is a configurable coaching starting point, not a validated elite sprint cutoff. The athlete is prompted to consider recovery or discuss ending the session; the app never ends training automatically.

## Deploy to GitHub Pages

Put **the contents of this directory** at the root of a GitHub repository, including `.github/workflows/pages.yml`. If creating a repository from this folder:

```sh
git init
git add .
git commit -m "Add Momentum sprint training diary"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin main
```

In the repository's Settings → Pages, select **GitHub Actions** as the source. The included workflow tests the comparison logic, copies only public app files into `dist`, and deploys them. No node_modules install or build step is needed. See the Actions deployment output for the final `https://YOUR_ACCOUNT.github.io/YOUR_REPOSITORY/` URL. Relative paths work for repository subpaths. Enable HTTPS. Your repository contains code and public configuration, never private schedules or results. Accounts and data remain in Supabase.

The app has not been published by this delivery; no GitHub repository or Supabase project is provisioned automatically. Configure accounts and validate the isolation checks below before live use.

## Verification

```sh
npm test
node --check app.js
node --check store.js
node --check gears.js
```

Automated tests cover matching protocols, gear separation, absent values, disabled thresholds, time loss, result validation, local dates and gear mathematics. Browser smoke tests cover demo athlete save, quality alert, coach editing/review, local persistence and chart selection. Supabase integration requires your project; no live account/database test was run in this delivery.

Before using real athlete data:

1. Anonymous REST requests must return no training rows and deny writes.
2. As Thalia, request Njisane's session/result IDs directly using the REST API: SELECT should return no rows; attempts to insert/update his results or alter a plan must fail. Repeat in reverse.
3. Attempt to alter your role in `profiles`: it must fail.
4. Jamie must read both athletes and create/update plans, but cannot change their result rows.
5. Submit an arbitrary effort UUID, negative values, RPE 11 or a split greater than total: the database must reject it.
6. Refresh/reopen on another device and confirm saved sessions/results persist. Disconnect the network and confirm failed saves show “Not saved”. Copy a completed session and ensure previous results do not follow the copy.

Official references: [Supabase Auth](https://supabase.com/docs/guides/auth), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Files

- `index.html`, `styles.css`: mobile interface and visual design.
- `app.js`: login, daily diary, coach builder and effort entry.
- `domain.js`: pure comparison, validation, date, template and gear functions.
- `gears.js`: gear chart and target finder.
- `store.js`, `config.js`: Supabase REST/auth adapter and public configuration.
- `supabase/schema.sql`: database, constraints, triggers and access policies.
- `tests/domain.test.js`: dependency-free Node tests.
- `.github/workflows/pages.yml`: test and deployment workflow.
