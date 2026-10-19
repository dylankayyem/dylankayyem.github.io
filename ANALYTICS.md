# Site analytics

The site counts page views and records what visitors do with the project
demos, so it can answer:

- How many people visit, from where (LinkedIn, a resume, a job application,
  search), and on which device?
- Do they reach the Projects section?
- Which demos get opened, and how far do people get in each one: signing in,
  doing the key thing, or leaving straight away?
- How long do they spend in a demo?
- Do they then reach out (email, LinkedIn, contact form) or grab the resume?

Everything is wired up and tested. The only step left is creating the
analytics account and pasting its ID into `analytics.js` (see **Turning it
on**). Until then the code runs but sends nothing.

## How it works

```text
every page ── analytics.js ──────────────► Umami (cloud.umami.is)
                 │  page view (clean URL, campaign tags kept)
                 │  section views, link clicks, theme, contact form
                 │
index.html ── demo.js (overlay)
                 │  demo_open · demo_new_tab · demo_restart · demo_close
                 │
                 └── iframe: demos/<id>/
                        kit.js / proto.js
                          demo_signin · demo_view · demo_action · demo_complete
                          └─ analytics.js inside the iframe forwards to the
                             parent page: one visit, one page view, no second
                             copy of the tracker
```

- **Provider: [Umami](https://umami.is) Cloud.** It sets no cookies, stores no
  personal data, and needs no consent banner. Its free Hobby plan is far
  more than a portfolio needs. Custom events carry properties (which demo,
  which view), and it has funnel, journey, UTM and goal reports. Rejected:
  Google Analytics 4 (cookies, and a consent banner to be compliant),
  Plausible (paid only), GoatCounter (no event properties or funnels), and
  Cloudflare Web Analytics (no custom events).
- **One file to swap.** Only `analytics.js` knows about Umami. Every other
  file calls `DKAnalytics.track(name, props)`. Moving to another provider
  means rewriting the `flush` function, nothing else.
- **Only production counts.** Events are sent only from `dylankayyem.com`,
  `www.dylankayyem.com` and `dylankayyem.github.io`, so local previews never
  affect the numbers.
- **Clean URLs.** Page views drop `#demo=…`, `?theme=` and the analytics
  switches, but keep `utm_*` and `ref`. Every demo page reports as
  `/demos/<id>/`.
- **Respects the visitor.** Do Not Track and Global Privacy Control turn
  analytics off. Nothing typed into a form or demo is sent, only the names of
  views and actions.

## Turning it on (about 10 minutes)

1. Create a free account at <https://cloud.umami.is>.
2. **Settings → Websites → Add website.** Name: `dylankayyem.com`, domain:
   `dylankayyem.com`.
3. Copy the **Website ID**, paste it into `analytics.js`, and push:
   ```js
   websiteId: '00000000-0000-0000-0000-000000000000',
   ```
4. **Exclude yourself.** On each of your own devices and browsers, visit
   `https://dylankayyem.com/?analytics=off` once. It's remembered in that
   browser. `?analytics=on` undoes it.
5. **Check it works.** In a private window, open the site, open a demo, sign
   in and do the key action. Within a few seconds Umami's **Realtime** view
   should show the page view, then `demo_open`, `demo_signin` and
   `demo_complete`.
6. Build the reports below.
7. Optional: **Settings → Websites → Edit → Share URL** gives a read-only
   dashboard link you can bookmark or share.

## Event reference

Every event also carries `page` (`home`, `about`, `pawprints`, `presto`,
`start`, or `demo:<id>` on a standalone demo tab).

### Site

| Event | Properties | Fired when |
| --- | --- | --- |
| *page view* | URL, referrer, device, country (Umami defaults) | Any page loads |
| `section_view` | `section`: skills, education, experience, projects, testimony, contact, resume | A section reaches the middle of the screen, once per page view |
| `project_link` | `project` (card title, e.g. `flowproof`), `link`: github, case-study, site, video, pdf; `host` | A link on a project card, other than Live demo |
| `outbound_click` | `host`, `path` | Any other external link |
| `contact_click` | `method`: email, linkedin | An email or LinkedIn link |
| `contact_form` | `status`: sent, error | The contact form is submitted |
| `resume_click` | `action`: download, open | A resume PDF link |
| `theme_toggle` | `theme`: light, dark | The theme button |

### Demo funnel

Every demo event carries `demo`: flowproof, healthcare, bloodbank, pawprints,
itsastart or presto.

| Event | Properties | Fired when |
| --- | --- | --- |
| `demo_open` | `source`: card, link (a `#demo=` URL), direct (a standalone demo URL), script | The overlay opens, or someone lands on a demo page directly |
| `demo_signin` | | Coded apps: the sign-in form is submitted. Prototypes: the first screen past sign-in is reached |
| `demo_view` | `view`: e.g. `overview`, `traces/detail`, `match` | Each new screen or view |
| `demo_action` | `action` (list below) | The visitor does something meaningful |
| `demo_complete` | `action`, `seconds`; prototypes also `via`: tap or steps | The first goal action in that demo session |
| `demo_restart` | `source`: overlay, demo | Restart is pressed |
| `demo_new_tab` | `seconds` | "Open in new tab" in the overlay |
| `demo_close` | `how`: button, esc, backdrop, leave; `seconds` | The overlay closes, or the visitor leaves the page with it open |

**Actions and goals.** The goal actions are the ones that trigger `demo_complete`.

| Demo | Actions | Goal |
| --- | --- | --- |
| FlowProof | `test_event`, `incident_ack`, `incident_resolve`, `key_create`, `key_revoke` | `test_event` (the failing-assertion moment) |
| Healthcare | `query_run`, `appointment_booked`, `patient_registered` | Any of them |
| Blood Bank | `transfusion`, `donation` | Either |
| PawPrints | (screens) | Reaching *My PlayMarkers* |
| It's a Start | (screens) | Reaching *Live session* |
| Presto | (screens) | Reaching the *Funds loaded* confirmation |

A prototype completed by clicking the step list instead of the phone has
`via: steps`. Filter on `via = tap` to count only people who used the
prototype itself.

## Reports to set up in Umami

| Report | Setup | Answers |
| --- | --- | --- |
| **Demo funnel** (Funnel) | Steps: event `demo_open` → event `demo_signin` → event `demo_complete`. Window: 30 minutes | Where people drop out of the demos |
| **Visit to demo** (Funnel) | Steps: page `/` → event `section_view` → event `demo_open` | Whether visitors reach the projects and open one |
| **Goals** (Goals) | `demo_complete`, `contact_form`, `contact_click`, `resume_click` | The outcomes that matter, as conversion rates |
| **Demos compared** (Events) | Event `demo_open`, broken down by property `demo`; then the same for `demo_complete` | Which projects attract interest and which hold it |
| **Time in demo** (Events) | `demo_close`, property `seconds` | Whether people actually explore |
| **Where visitors come from** (UTM / Referrers) | Built in | Which shared links work |
| **Paths** (Journey) | Start at `/` | The common routes through the site |

Umami renames its menus from time to time. If one of these names doesn't
match, look for the report type in brackets.

## Tag the links you share

Umami groups visits by `utm_source` and `utm_campaign`, and page views keep
those tags. Use a tagged link wherever you post the site, for example:

| Where | Link |
| --- | --- |
| LinkedIn profile | `https://dylankayyem.com/?utm_source=linkedin&utm_medium=profile` |
| Resume PDF | `https://dylankayyem.com/?utm_source=resume` |
| Job application | `https://dylankayyem.com/?utm_source=application&utm_campaign=<company>` |
| GitHub profile README | `https://dylankayyem.com/?utm_source=github` |
| Straight to a demo | `https://dylankayyem.com/?utm_source=linkedin#demo=flowproof` |

## Debugging

- `?analytics=debug` logs every event to the browser console, says whether
  it's being sent (and if not, why), and is remembered in that browser.
  `?analytics=on` turns it off.
- `DKAnalytics.events` in the console lists everything recorded on the
  current page.
- Local previews (`localhost`) never send. Use debug mode there to see what
  would be sent.

## Adding an event

- On the site: `DKAnalytics.track('thing_happened', { key: 'value' })`. Guard
  the call with `if (window.DKAnalytics)`.
- In a coded demo: `Demo.action('name')`. Add the name to `goals` in
  `Demo.init` if it should count as completing the demo.
- In a prototype: screens are tracked automatically. Set `signedIn` and
  `goal` in `Proto.init` if the defaults (the second screen and the last
  screen) are wrong.
- Name events in `snake_case`. Keep property values to a short, fixed set,
  never free text or anything a visitor typed.

## Limits

- Ad blockers that block analytics hosts will hide some visits, so treat the
  numbers as a floor rather than an exact count.
- Umami's free plan has a monthly event cap and limited data retention.
  Check the current limits on its pricing page. A portfolio sends a few
  dozen events per visit at most.
- `demo_close` with `how: leave` is sent while the page unloads. Browsers
  deliver it in nearly every case, but not all of them.

## Review cadence

Once a month, look at the demo funnel and the demos-compared report. Use them
to prioritise the [demo roadmap](DEMOS.md#roadmap). A demo that people open
but rarely complete needs a clearer first step. A project that people rarely
open needs a better card.
