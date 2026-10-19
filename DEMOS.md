# Project demos

Every project card on the portfolio has a **Live demo** button that opens the
project in a glass overlay over the page. Visitors can sign in, look around
and click through without leaving the site. Each demo is static HTML and
JavaScript, so it runs on GitHub Pages with no backend, costs nothing to host
and can't break when an old deployment expires.

## What each demo shows

| Project | Demo type | Flow | Data |
| --- | --- | --- | --- |
| FlowProof | Coded app | Sign in → overview → flows → trace explorer → incidents → API keys | Generated: 4 flows, ~500 traces, incidents grouped per failing check |
| Healthcare Database | Coded app | Staff sign in → dashboard → patients → doctors → appointments → query explorer | Generated against the project's real schema (`patient_table`, `doctor_table`, `room_table`…) |
| Blood Bank Database | Coded app | Sign in → dashboard → inventory → patient–donor matching → donations → transfusions | The project's own `flask/sample_data` CSVs |
| PawPrints | Figma prototype | Sign in → match → it's a match → PlayMarker map → verify → my PlayMarkers | Final design screens |
| It's a Start | Figma prototype | Sign in → check-in → communities → support group → live session | Final design screens |
| Presto redesign | Coded prototype | Terms → sign in (with error state) → card → load funds → confirmation | Sample card and balance |
| Titan Vans & Timber Van Kits | No demo | The live sites are the demo; the card links to both | — |

Things worth trying in each:

- **FlowProof:** press *Send test event*. A new trace arrives, the Vehicle Link
  assertion fails even though every step "succeeded", and an incident opens.
  That is the product's core idea in one click. Incidents can be acknowledged
  and resolved, and API keys created (shown once) and revoked.
- **Healthcare:** the *Query explorer* runs saved SQL from the project against
  the sample data, including the diagnosis-change audit log the project built
  with a trigger.
- **Blood Bank:** pick a patient in *Matching* to see compatible blood types
  and the best-stocked hospitals, then *Transfuse*. Recording a donation
  updates that hospital's stock.
- **Prototypes:** tapping anywhere that isn't a button flashes the tap
  targets, the same way Figma prototypes do. *Show tap targets* keeps them
  visible.

## How it fits together

```text
index.html  ── "Live demo" button (data-demo="flowproof")
   │
   ├── demo.js / demo.css     the overlay: glass window, iframe, restart,
   │                          open in new tab, close (button, backdrop, Esc),
   │                          #demo=<id> deep links, live theme sync
   │
   └── demos/
       ├── kit.js / kit.css   shared app shell for the coded apps:
       │                      sign-in gate, sidebar + topbar, hash router,
       │                      stat tiles, tables, charts, badges, timeline
       ├── proto.js / proto.css  shared runner for prototypes: screen list,
       │                      image screens with tap targets, or coded screens
       │                      inside a drawn phone frame
       ├── flowproof/   healthcare/   bloodbank/     (kit)
       └── pawprints/   itsastart/    presto/        (proto)
```

- Each demo is a normal page, so it also works on its own:
  `dylankayyem.com/demos/flowproof/` (the overlay's "open in new tab" button).
- The portfolio passes `?theme=light|dark` on open and posts a message when the
  visitor flips the theme, so the demo always matches the site.
- State lives in memory and `sessionStorage`. *Restart* in the overlay reloads
  the demo from the sign-in screen with fresh sample data.
- Demo pages carry `noindex`, so search engines don't index sample data.
- Nothing is real: names, records, balances and keys are sample data. The
  only requests a demo makes are anonymous analytics events (which view, which
  action), never anything typed into it.

## Adding or updating a demo

**A coded app** (dashboard-style):

1. Copy `demos/flowproof/index.html` into `demos/<id>/` and change the title
   and the three `--brand` colours.
2. Write `demos/<id>/app.js` that builds sample data and calls
   `Demo.init({ id, name, icon, nav, views, login, user })`. Each view returns
   `{ title, crumbs, actions, html, after }`; use the helpers on `Demo`
   (`stat`, `card`, `table`, `bars`, `kv`, `badge`, `toast`, `go`). Call
   `Demo.action('name')` for meaningful actions and list the ones that count
   as finishing the demo in `goals`.
3. Register it in the `DEMOS` map at the top of `demo.js`.
4. Load `../../analytics.js` before `../kit.js` in the demo's `index.html`.
5. Add the button to the project card in `index.html`:
   `<a class="demo-link" href="demos/<id>/index.html" data-demo="<id>" …>`.

**A design prototype:**

1. Export the final screens to `demos/<id>/screens/*.webp` (about 1600px tall
   is plenty).
2. In `demos/<id>/app.js`, call `Proto.init({ screens, order, start })`. Each
   image screen lists tap targets as percentages of the image:
   `{ x, y, w, h, to: 'next-screen', toast: 'optional message' }`. A screen can
   instead provide `html(state)` for a coded screen, as Presto does. Set
   `signedIn` and `goal` (screen keys) if the analytics defaults, the second
   and last screens, are wrong.
3. Steps 3 to 5 above (with `../proto.js` instead of `../kit.js`).

**Before pushing**, open each changed demo at phone width and desktop width in
both themes, sign in, visit every view, and check the browser console is clean.

## Roadmap

1. **FlowProof:** once the app is deployed, point the demo at a read-only
   sandbox organisation on the real stack (seeded traces, a demo API key that
   can only write to the sandbox) and keep this static version as the
   fallback when the sandbox is down.
2. **Healthcare Database:** the card's *App* link points at a Vercel preview
   URL. Promote it to a stable production URL or retire it in favour of this
   demo.
3. **Blood Bank:** replace the recorded video with a short screen recording of
   this demo, which matches the current design.
4. **Prototypes:** add the remaining PawPrints flows (messages, onboarding)
   when those screens are designed.
5. **Measurement:** every demo reports a funnel (open → sign in → key action
   → close, with time spent). See [ANALYTICS.md](ANALYTICS.md) for the events,
   the reports to build, and the one setting left to turn it on.
