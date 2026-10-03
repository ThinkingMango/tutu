# Picture packs

Each folder here is one picture pack. The folder is the whole pack: the app reads its name, icon, pages and art from here, so adding a pack never means editing app code.

```
art/<pack>/
  pages.json        name, description, icon, shelf order, draft or published, image style, page list
  source/<page>.png the picture for each page
  labels.json       a spoken name for every area children can tap
```

The tools write two more things you don't edit by hand: the traced pages in `lib/templates/<pack>/`, and `lib/templates/registry.generated.ts`, which puts every pack into the app.

## Adding a pack, step by step

Run `pnpm packs status <pack>` at any point. It ticks off what's done and prints the exact next command.

Working in v0? Ask for each step in chat, for example "Start a Farm Friends pack with these 16 pages", "Draw the missing pictures", "Trace them" or "Name the areas". v0 runs the same commands.

### 1. Plan

```bash
pnpm packs new farm-friends --name="Farm Friends" --icon=tractor
```

This creates `art/farm-friends/pages.json` as a **draft**. Open it and:

- write the `description` parents read on the billing page
- adjust the `style` if the pack needs its own setting, for example "in a simple farmyard with big flowers"
- list the pages, one per line, with a unique id, a name and a subject for the image prompt:

```json
{ "id": "cow-meadow", "name": "Cow Meadow", "subject": "a happy cow in a meadow of big daisies" }
```

Page ids are lowercase words joined by dashes and must be unique across every pack. `pnpm packs icons` lists the icons you can use.

**Packs are for children only.** 漫涂涂 doesn't plan adult packs (decided 2 October 2026), so create every new pack without `--audience`. The `--audience=grown-ups` option and the shelved Zen Mandalas draft are kept only in case that decision changes: they set adult art rules (40 to 320 areas, each at least 16 units wide) and a thinner outline, but the app never lists or sells grown-up packs while `GROWN_UPS_OFFERED` in `lib/packs.ts` is `false`. See "Product scope" in `docs/plan.md`.

### 2. Draw

```bash
pnpm packs prompts farm-friends
```

This prints the full image prompt for every page that has no picture yet. Generate each one and save it as a square PNG at the printed path, `art/farm-friends/source/<page>.png`. Use only original art.

### 3. Trace

```bash
pnpm packs trace farm-friends            # every page
pnpm packs trace farm-friends cow-meadow # one page
```

This turns each picture into tap-to-fill areas and checks the art rules: 10 to 24 areas, nothing too thin to tap, and an outline that doesn't leak into the background. Review sheets land in `.pack-review/farm-friends/<page>.png`, showing the source, the areas colored in and the blank page.

If a page fails, redraw it with simpler shapes. If only tiny slivers are the problem, set a larger `"minArea"` on that page in `pages.json`, for example `0.008`, and trace it again.

### 4. Name the areas

Screen readers speak each area's name when a child taps it, so every area needs one.

```bash
pnpm packs sheet farm-friends   # numbered sheets in .pack-review/farm-friends/
pnpm packs labels farm-friends  # writes art/farm-friends/labels.json
```

Replace each placeholder in `labels.json` with a short name, using the numbers on the sheet ("Cow face", "Left ear", "Big daisy"). For round pages with hundreds of areas, `pnpm packs labels <pack> --by-position` fills every placeholder with its ring and clock position instead, such as "Centre" or "Middle ring, 3 o'clock". Names you've already written are kept. Then run `pnpm packs labels farm-friends` again to put the names on the pages. Names are tied to the exact picture. If you redraw a page, its names reset and the command tells you so.

### 5. Try it, then publish

Drafts show on the shelf with a **Draft** badge in development and the v0 preview, and never in production. Color a few pages there. When it looks right:

```bash
pnpm packs publish farm-friends
pnpm test
```

`publish` refuses until every step is done. Once published, the pack is listed for everyone and can be bought on its own. `pnpm packs unpublish <pack>` turns it back into a draft.

## After a pack is published

- **Don't change the pictures.** Children's saved artwork is pinned to the areas they colored, so `pnpm packs trace` won't retrace a published page unless you pass `--replace`. To change a picture, add a new page instead.
- **Names and descriptions are safe to change.** Edit `labels.json`, then run `pnpm packs labels <pack>`. Edit `pages.json` for the name, description, icon or order, then run `pnpm packs sync`.
- **Pages that shipped with an older drawing** keep it as their first version in `lib/templates/earlier-drawings.ts`. Never remove an entry there.

`pnpm test` checks every published pack against these rules, and fails if the registry is out of date with `art/`.
