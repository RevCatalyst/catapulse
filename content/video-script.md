# Catapulse 1-minute video package

## Goal

Show that Catapulse turns RevenueCat subscription data into a founder-readable brief faster than a traditional chart dashboard.

## Recommended format

- **Length:** 55–65 seconds
- **Aspect ratio:** 16:9 for X, GitHub, blog embeds, and Vercel landing clips
- **Style:** screen recording + light motion zooms + captions
- **Pacing:** calm, technical, clear

## Should the video have music?

**Best default answer: no music.**

Because this is a technical product demo, clarity matters more than vibe.

If you do want music, use only:

- subtle ambient bed
- no vocals
- no drums that compete with narration
- volume very low under the voiceover

### Recommended music approach

- start at **-26 dB to -22 dB** under narration
- duck even lower during any dense explanation
- use a slow ambient synth or soft electronic pad
- avoid “startup hype” music

### My recommendation

For this video, I would ship:

- **voiceover + UI sounds + captions**
- **no music**

That will feel cleaner and more credible.

---

## 60-second storyboard

### 0:00–0:05
**On screen**
- Catapulse home page loads
- title visible
- table visible immediately

**Overlay text**
`RevenueCat founder brief, not another dashboard.`

**Voiceover**
"Most subscription dashboards show you charts. Catapulse shows you what changed and what it means."

---

### 0:05–0:13
**On screen**
- slow zoom toward the table headers
- highlight the four columns:
  - Metric
  - Current
  - Change
  - Current situation

**Overlay text**
`One table. One operating read.`

**Voiceover**
"It turns live RevenueCat data into a single founder brief with the current metric, the period-over-period change, and a plain-language interpretation."

---

### 0:13–0:24
**On screen**
- move down the table
- pause over MRR, Revenue, Conversion to paying, Churn rate

**Overlay text**
`Acquisition. Conversion. Retention. Revenue.`

**Voiceover**
"Instead of making founders interpret a wall of cards, Catapulse organizes the metrics that actually matter: acquisition, conversion, retention, and recurring revenue."

---

### 0:24–0:36
**On screen**
- click `Last 7 days`
- click `Last 28 days`
- click `Last 90 days`
- let the values visibly update

**Overlay text**
`7d / 28d / 90d windows that actually change the brief.`

**Voiceover**
"The range selector changes the underlying calculations too, so seven-day, twenty-eight-day, and ninety-day views give you meaningfully different business reads."

---

### 0:36–0:47
**On screen**
- move to top metadata row
- highlight Project ID, Project Name, Coverage
- click `Change`
- reveal key input form

**Overlay text**
`Load another RevenueCat project from a V2 key.`

**Voiceover**
"You can also switch projects by pasting another RevenueCat V2 key. Catapulse resolves the project and rebuilds the same brief for that app."

---

### 0:47–0:56
**On screen**
- show repo URL and production URL
- optional small split-screen with GitHub repo + live site

**Overlay text**
`Built with RevenueCat’s Charts API`

**Voiceover**
"Under the hood, it uses RevenueCat’s Charts API to fetch live subscription metrics and turn them into an operator-friendly summary."

---

### 0:56–1:00
**On screen**
- final hero frame with app title + URLs

**Overlay text**
`Try it: catapulse.vercel.app`

**Voiceover**
"If you want a faster weekly read for a subscription business, try Catapulse."

---

## Full voiceover script

Most subscription dashboards show you charts. Catapulse shows you what changed and what it means.

It turns live RevenueCat data into a single founder brief with the current metric, the period-over-period change, and a plain-language interpretation.

Instead of making founders interpret a wall of cards, Catapulse organizes the metrics that actually matter: acquisition, conversion, retention, and recurring revenue.

The range selector changes the underlying calculations too, so seven-day, twenty-eight-day, and ninety-day views give you meaningfully different business reads.

You can also switch projects by pasting another RevenueCat V2 key. Catapulse resolves the project and rebuilds the same brief for that app.

Under the hood, it uses RevenueCat’s Charts API to fetch live subscription metrics and turn them into an operator-friendly summary.

If you want a faster weekly read for a subscription business, try Catapulse.

---

## Shot checklist

Before recording, make sure the app state is ready:

- app deployed and loading successfully
- default Dark Noise project visible
- table fully loaded before screen recording starts
- cursor movement is slow and deliberate
- browser zoom feels comfortable for text readability
- no irrelevant tabs or browser clutter visible

## Recording tips

- record at 1440p or 1080p
- keep cursor visible
- use gentle zooms in editing, not constant movement
- add burned-in captions
- do not cut too quickly; the table needs a beat to be readable
- leave 0.5s of silence before first line and after final CTA for cleaner editing

## Captions recommendation

Use captions even if there is voiceover.

Caption style:
- white or light gray text
- black translucent background or subtle shadow
- bottom-center placement
- one or two short lines max

## Editing recommendation

If you want the video to feel polished without overproducing it:

- use straight cuts
- add only minimal scale-in emphasis on the table
- no flashy transitions
- no whooshes
- no cinematic intro

The more the video feels like a sharp product demo, the better.
