# Design direction

Lantern's visual language as it stands: its principles, its palette and type, the chart it draws a day on, how things move, how components are designed for what a model writes, and each surface of the product. Visual values live in tokens (`src/app/globals.css`, `src/lib/tokens/`), lint holds them, and `/lab/tokens` shows them. Each agreed decision has an entry in `docs/decisions.md` with its reasons and what it costs.

The owner made the design calls, mostly by comparing options drawn side by side on real days, in both themes, at a phone's and a laptop's width. AI agents drew the options, built the chosen one and measured it frame by frame.

## Principles

- **The layout carries meaning.** Where a stop stands says how lively it is, and how far down, when.
- **Real data first, never a skeleton.** Only what has arrived is shown, in the order the model writes it.
- **A pen, not a spinner.** Words are written in as they arrive. A pause in the stream shows as light running through the words that name what is being written.
- **One colour, one meaning.** Light is amber, energy is green, the other versions are blue, and what is chosen is ink. Nothing else in the chart has a colour.
- **Density follows energy.** A calm row opens with how its place sounds; a lively one folds to its name and kind.
- **Surfaces mean something.** Only an open stop's sheet is raised. Everything else sits on the ground.
- **Answer first, ask after.** Lantern never asks before it answers. The day is planned on assumptions at once, and each one is marked in the headline and one tap from being changed.
- **The page never changes the day by itself.** Every change is the visitor's gesture. A preview is drawn dashed.

## Where we are

### Ground and ink: Night market

By day the page is a sunlit wall gone to unbleached paper, `#FBF5EA`, with ink in a petrol shade, `#001924`. By night it is a petrol sky, `#011D27`, where whatever a lamp touches is warm: the ink is paper, `#F7EDDF`. One pair of colours, their roles swapped. An open stop's sheet is `#FFFDF8` by day and `#0C272C` by night.

The day ground is the owner's pick of three, tried on the live page through a switch that rewrote its tokens: paper, a warm cream at three quarters of an earlier ground's chroma. The others were an apricot wall, which read as peach across a laptop's empty margins, and a deeper stone, which would have needed energy's green a shade deeper to keep its words at 5:1. The fuller cream before it read as custard across those margins, and a half-chroma one as nearly white. The petrol ink, the night and the accents keep the page apart from the warm neutrals common to AI products.

### Accents: light, energy and versions

Each meaning has two tokens: one says it in words, at 5:1 like all text, and one draws it, at 3:1, the bar for graphics.

| Meaning  | In words                 | Drawn                        | Drawn as                                          |
| -------- | ------------------------ | ---------------------------- | ------------------------------------------------- |
| Light    | `amber` #8B4800/#EDAD60  | `lamp` #BB660A/#FFBA4D       | The mark's bead, the suns, golden hour, lit beads |
| Energy   | `energy` #07775C/#34B7B1 | `curve` #209C7B/#34B7B1      | The energy curve and the rings on it              |
| Versions | `swap` #005D8E/#8DCCF8   | `swap-drawn` #4086BD/#4381AA | The hollow beads, and the ring that names one     |
| Chosen   | `ink`                    | `ink`                        | The filled bead of the place shown                |

Light needs two tokens because on a pale page a lamp dark enough for 5:1 text is darker than the page, so it reads as a dot whatever its hue. Energy's words and its curve share one green, so "calm" and its line read as one thing. The versions are drawn a step quieter than the ink bead chosen, so sixteen hollow rings never compete with it. The mark's two steps of light, `lamp-glow` and `lamp-haze`, are solid colours, since an alpha step over a ground of another hue mixes towards grey.

`src/lib/tokens/palette.test.ts` reads `globals.css` and holds the bars: every text 5:1 on the ground and the sheet, every drawn accent 3:1, and the accents at least 12 ΔE2000 apart, and apart from the muted inks, for protan and deutan eyes.

### Type: one sans

Every role is Fira Sans regular, in Latin, latin-ext and Cyrillic. Size and ink tell a name from a note: no serif, no monospace, no capitals, no second weight. The model's sentences are set in Fira's italic, the line about the day, a row's line on how it sounds and a sheet's summary, while the visitor's request stays upright. So italic is how Lantern speaks, and the wordmark is italic too. Names in other scripts arrive in their usual Latin spelling, and the script check holds every generated word to Latin and Cyrillic.

Why one sans. A serif headline over a grotesk, with small monospace capitals on every row, read as the look of generated sites, and the monospace capitals carried the most useful words at the smallest size. The owner found one sans the easiest to read, and the abacus is a timetable, whose native type is the all-sans of transit and information design. The bars for the face: latin-ext and Cyrillic, tabular figures, a large x-height, 1, l and I and 0 and O told apart, a true italic, and not a face common on generated sites. Of thirteen faces measured, Fira Sans and Ubuntu Sans were tried on the day. Ubuntu Sans set 13% lighter, which costs a glance in sunlight, and reads as Ubuntu to anyone who has used Linux. Names are regular, not medium: the owner found the medium names a little heavy.

Display and title sizes grow with the width they are set in (`cqi`), so a phone-width cell in `/lab/matrix` sets them as a phone does.

### Tokens

The Tailwind theme in `src/app/globals.css` is closed: colours, the type scale, spacing, widths and radii. Motion springs and icon sizes live in `src/lib/tokens/`. Colours carry both themes through `light-dark()`, so `data-theme` on any element switches its subtree. Lint rejects every value outside the tokens, and a new value is a new token, listed in the catalog and shown in `/lab/tokens`. The keyboard's focus ring is `focus-ring`, or `focus-ring-inset` where what stands around an element would cut it.

### The abacus

A day is drawn on one chart, one press from its plan, which a day opens on: time runs down, energy runs across, from reflective to social in five lanes. Each stop is a wire. The model writes, for each stop, a quieter and a livelier version, or one toward the middle at an end of the scale, and each version is a hollow bead on the stop's wire at its energy. The place shown is a filled ink bead. An energy curve runs through the day; drag it at any point and each stop shows the version nearest it. The model writes the options, the code picks, and both are on screen.

- **Picking.** A stop switches only when another version is nearer the curve by 0.2 levels, so a hand resting between two beads never makes it flicker. A pull moves the stops either side of the hand, each by how near it is grabbed. Between stops the curve never swings past its neighbours.
- **Direct picks.** A tap on a hollow bead swaps it in. With the keyboard each stop is a slider: the arrows move to its next quieter or livelier version, Home and End to its quietest and liveliest.
- **A version is named before it is taken:** under a pointer, from the keys, and while dragged ("→ Tofu courses near Keage"), beside its bead and away from the hand.
- **The ends of the scale.** A stop at an end has nothing drawn on its empty side. That emptiness is the message: there is nothing quieter to swap to.
- **Names on the wires.** Each row's words sit beside the bead it shows, so where a name stands says how lively the place is. They sit right of the bead, the way they read, and go left only when they fit whole there and not on the right. They stand a bead's 12 px hit radius clear of the wire, and a halo of the ground around each letter lets the curve pass under them, as maps label across roads. Two versions at one energy stand 24 px apart, each a whole 24 px target.
- **Weight.** Wires are structure, at 2:1 on the ground. The chosen bead is ink and the curve 2.5 px, so the thing to touch leads.
- **The invitation.** Once the day can be dragged, a ring with an arrow either side waits on the curve at a stop in view, and a dashed curve draws the day a pull there would give. It shows once on a page, and never to a visitor who has dragged a curve on this device. The energy scale names the curve, "drag the curve", and the headline gains a clause in energy's colour for each change from the plan.

### Density

A row's density follows the energy of the version it shows. Calm and reflective rows open with the place's texture in the model's italic. Lively and social rows fold to name and kind, with how full and how loud under them in two words, "busy · chatter". Balanced rows keep name, kind and neighbourhood, with the same two words. A place to eat is named by its food and where, "Petiscos on Rua das Flores", and says its meal by the hour.

The owner chose this over one density for every row and over opening only the row under the hand. It is the brief read literally: the day visibly reshapes as its energy moves.

### Light

Light lives on the time axis. The axis runs in the lamp's colour through golden hour, dotted from sunset to sunrise, and plain in daylight. The sun stands on the axis at sunset, and at sunrise when the frame holds it, with its minute beside it in amber where it has room. A stop that starts in golden hour says its time in amber. A place gets a small sun beside its name only when its visit spends at least 20 minutes in its own sunrise or sunset window. The windows come from the sun at the place's coordinates on the day's date (`src/lib/geo/light-windows.ts`), so they move with the season and the latitude, through a polar night and a midnight sun.

Light is a quiet quality of the page. Energy and swapping carry its gestures.

### The mark

The lit bead: a bead on a wire with two solid steps of light around it, drawn on the icon grid with a 16 px drawing of its own. The light stays round, since on the light ground a light cast downward reads as a shadow, and it has no rays, which would read as another AI product's mark. The wordmark is "Lantern" in Fira's italic. The files and their rules are in `docs/brand/`. The name fits the chart: beads on wires read as lanterns strung over a street.

## Motion

### Springs

Anything that moves uses one of three springs from `SPRINGS` (`src/lib/tokens/motion.ts`), picked by intent, so feel is tuned in one place:

- `snappy`, settling in 0.2 s with a little bounce, for taps and toggles, and a word's list opening;
- `layout`, 0.4 s, for rows reflowing as the energy changes and swaps morphing in place;
- `gentle`, 0.6 s with no bounce, for stops arriving while the day streams in.

Colour and opacity changes on hover and focus are CSS transitions, timed by tokens too.

### Pointed at

What can be pressed answers a pointer, and the keyboard's focus shows the same, in the page's ink, never an accent. A word with no underline takes the ink hairline; a word already underlined, a link, takes its rule twice as heavy; a box shows its frame or its ground. An index cell pointed at stands forward, its city ruled and its engraving up to full ink from the 90% they all rest at where a pointer can hover, while a touch screen draws them all full; a version's arrow on the plan leans its stop 12 px toward the version it names. A touch screen shows none of it, since a finger cannot hover (`docs/decisions.md`, "What can be pressed takes a rule in ink under a pointer, and the keyboard's focus shows the same").

### Three pixels a frame

Nothing the visitor is reading moves more than about 3 px in a 60 Hz frame. Above that a move reads as a jump rather than a glide, and an eye reading a row loses its place. A spring that does not bounce moves faster the further it goes, so a long glide is given proportionally longer: `springOver` stretches a spring's time by its distance over a reach, `GESTURE_REACH_PX` (55 px on the gentle spring) for what a gesture moves, `ROOM_REACH_PX` (36 px on the layout spring) for the header's room, `ROW_REACH_PX` (28 px) for a row of the list to read. A gesture over the whole day still settles in about 1.5 s.

One move is an exception: a stop on the plan swiped to another version slides out of the column as the version slides in, on the layout spring, faster than the rule allows, about 16 to 28 px a frame across a phone. The visitor starts it to replace the stop, so nothing they are reading moves under them, and no row around it reflows while it slides; the rows below glide as the rule asks once the new version's height is known (`docs/decisions.md`, "A stop on the plan swipes along its versions").

The rule is measured, not eyeballed. E2E specs read the page on every animation frame at a phone's and a laptop's width and fail a row that moves faster; `pnpm e2e:busy` holds the same rules on a page slowed as a busy machine slows it. And where a component must answer a changed prop in the same paint, it sets state during render rather than in an effect, so no frame paints the old state first.

### As each stop arrives

The day is written onto the chart in the order the model writes it, so the visitor sees the interface made from data rather than loaded.

Before the model writes anything, the headline and the facts line are already there: they come from the visitor and from code, not from the model. The chart's frame, its energy words and time axis, appears once the header's room is known, and the time axis grows with the rows. There are no skeletons.

As each stop arrives:

1. **Its start time.** The row's time appears in the gutter, over a hollow bead on its wire at the energy asked for: placed in time, its energy not decided.
2. **Its place.** A place streams its name, kind and neighbourhood, then its point, energy and light, and only then the summary that only its sheet shows. The row waits until its light is written, since that is the last of what it shows. Then its bead is weighed: it fills and slides to its energy, and the pen writes the name where it will rest, then its kind and where it is. A row lays out once, so no name changes its lines once seen.
3. **The curve** reaches the stop by following its sliding bead. It passes only through stops whose energy is known, and never changes shape in a single frame.
4. **Light.** A stop at its best light gets its sun.

After the stops, each stop's versions arrive in turn, top to bottom, their beads fading in on the wire. A line under the chart says how far the day is written, its stops so far, then its versions stop by stop. When the day is whole, the chart can be dragged and the invitation appears.

In a silence of 0.4 s on the page, the phrase naming the part of the day being written stands where the next name will be, with light running through its letters. A fast stream never shows it.

#### Rules

- One movement per stop at a time.
- Nothing is shown before its data exists, and nothing is invented to fill the space.
- A streamed number or enum value is final only once the next field has started: a duration grows 1, 15, 150 as it streams, and a string can stop mid-word.
- The stream draws only what the finished day will keep. A version the normalizer will drop, past the 800 m walk or named as one of the day's stops, is never drawn, so nothing leaves as the day lands.
- Rows ease, never jump. A row is measured before its first paint, and its words go where its bead comes to rest.
- Under reduced motion each element appears in its final state as its data arrives, and a row lands whole.
- A day this device has already watched to its end opens whole, without its replay.

## Dynamic UI

The model writes the content, so a component is designed for the whole space of data and states, not for one mockup. `CLAUDE.md`, "Designing components (Dynamic UI)", sets the rules, and the `/lab-component` skill is the order of work. In short: every value the schema allows must look intentional, from the shortest name to the longest; every lifecycle state, from nothing yet through partly streamed to complete and interactive, plus every ending without a day; density as an axis; props that are schema types; and a `/lab/matrix` entry that sets every cell in both themes.

Edge days make the space concrete: a minimal day, a long stay, a crowded day, a polar night, a midnight sun, a night past midnight, and a day the normalizer must repair or refuse. They have found real faults. "Basílica i Temple Expiatori de la Sagrada Família" in a middle lane took three lines on a phone, which led to the rule that a name keeps to its column beside its bead. Barcelona's longest name widened the page to 540 px on a phone, so a test now holds every edge day to the screen's width. A midnight sun once emptied every light window, until the windows were anchored on the sun's noon.

## The surfaces today

### The start screen

At `/`, one line says what Lantern is. Under it, "Where, and anything else", a field that wraps the visitor's sentence and grows with it, and "Plan this day". Then the visitor's own days, if any. The start screen has two ways in of one weight. Under the question, "No city in mind? Start from one of these" stands over an index of the days Lantern has written: a grid on the page's paper, two across on a phone and four on a laptop, each cell its city's engraving of an everyday thing of the place, centred at one optical size, and its city in the voice's size and its day in a few words centred under it; a press opens it where the question was, and a cell pointed at stands forward, its city ruled and its picture up to full ink from the tenth under it the others rest at where a pointer can hover. The light theme draws each picture's whole scene, its setting with it; the dark theme draws its subject alone, at its own size. A city with no picture yet keeps its caption on the row's line (`docs/decisions.md`, "The index's pictures are engravings of a city's everyday thing"). Under the index stands a written day's first three stops, still, in the day's own list, the plan's once the plan is the list, with "The whole day, N stops", the day's own count, as its one link: what a day looks like, shown without playing (`docs/decisions.md`, "The start screen is an index, with a day's first stops under it"). Nothing plays and no chart is drawn until a press.

After a press the waiting light passes through the visitor's words while they are read, then a line saying the day back. The start screen keeps its place until Lantern's words for the headline have streamed whole, up to 8 s, so the page turns once, onto the day's own sentence, written in its order into room held for every word. A day that fails before that turn stays on the start screen: the line says what happened, "Start from one of the days below." points to the index, and the field's button reads "Plan it again".

An address with no day, `/day/paris` as much as `/nope`, gets one page: the wordmark, "Lantern has no day at this address.", the written days, each as its sentence, and "Plan your own day". No 404 picture, no apology.

### The day page

**The headline is the request,** a sentence. Every word that can change opens its list in place, hanging from the word: the word is never drawn twice, its underline turns solid, and a check marks the answer. Under each answer one line says what choosing it does, "rewrites lunch and dinner · about half a minute" or "re-picks at once". Lantern's assumptions are dotted in muted ink; the visitor's own words carry no mark. A word the model left open has its cue in muted ink, the company said as a phrase, "with anyone". A word never breaks inside itself. The hint, "tap a word to change it", is a caption quieter than the date, and goes at the page's first change, a swap or a drag as much as a word.

**The line about the day** is the model's, in italic. While any stop shows another place than the one it was written around, it is led by "As first planned:", said lighter than the line. The facts line gives the date, sunrise and sunset.

**The masthead** is one line of two weights: the wordmark alone on the left at the body's size, its mark drawn in ems of the word so the bead stands on the word's lowercase middle, leading to the start screen, and on the right one group, on a day the day's menu and the theme as an icon (Monitor, Sun, Moon) with a short rule between them, elsewhere the theme alone. The menu is "Take this day", which holds "Copy the link", "Add to your calendar", "Walk it in Google Maps" and, set apart, "Plan another day", each with a line saying what it does; the line under the finished day keeps its summary alone (`docs/decisions.md`, "The day's ways along live in one menu, in the masthead").

**The chart** is the abacus above, and "Plan · Chart" switches it with the day's plan. Each day has its own address. Back returns to the start screen while the day writes on, and a link opens a kept day for 30 days for anyone who has it.

### The fork

A changed word proposes its part of the day beside the day on screen. The proposal is drawn on the same chart at its own hours, as compact blue rows on dashed wires, with a dashed second curve that forks after the part's last kept stop and rejoins at the next. Over each part stands a fork row: the two answers as a radio group, the visitor's filled in ink and the proposal's hollow in blue, what Lantern is doing, and then what the proposal would change, worked out by code from the two days, "Dinner 21:00, not 18:15 · 3 new stops". Taking it is the tap that already takes a version: the blue dries into ink and the old part folds into the fork row, one tap from coming back, with "Compare" beside it. The next changed word settles the fork. A failure fades the proposal, and the fork row says why. The sentence says the choice in the visitor's own words, "early dinner or eating late", the proposal's answer in blue and a link to its fork.

The owner chose the fork from four re-plan concepts, for three reasons. The visitor's day is never taken away: before, the new part was drawn over the old one, which was struck out, so comparing meant remembering what was there. Taking is a gesture the chart already teaches, a hollow blue bead and a dashed curve. And a failure changes nothing, because nothing was changed: production's Elche day, whose new coffee repeated the morning's, used to land over a struck day and give it back.

### The plan

A day opens on its plan, a timetable of the chart's own stops and picks: each stop's time, its name and sun, what it is and where until when, and its one line. "Plan · Chart" over it switches to the chart, and the choice is kept in this browser by its value, so a visitor who chose the chart, the site's first view once, keeps it. It is built from the chart's own state, so a swap on one is a swap on the other, and no model writes a word for it. The plan is written as the chart is: a stop comes in once all its row says is final, and its versions in a second pass. A proposal stands among the day's stops in blue, "proposed" under its time. It reads at once, in transit, on a small screen and to a screen reader, where the chart's encoding must be learned first; the chart stays the product's signature, one press away.

A rail runs down beside the times, the day's light drawn on it: a wire through daylight, the lamp through golden hour, dotted from sunset to sunrise; each stop's bead stands on it, a stop's time in amber when it starts in golden hour, and the sun's minutes stand in the list as lines of their own where they fall. No rule parts the rows; the rail does. Over the plan, held at the screen's top as it scrolls, the day's energy is five words beside the switch, the headline's own energy word: one chosen moves every stop to its version nearest it (`docs/decisions.md`, "A day opens on its plan, lit by the day's light"). A stop with versions is a carousel of them: dragged, it follows the hand and shows the version waiting on the side it is pulled from, the quieter on its left and the livelier on its right, as the chart's wire runs; under it each side names its version with an arrow that plays the same slide, and the arrow keys on the stop do too (`docs/decisions.md`, "A stop on the plan swipes along its versions").

### The sheet

Opening a stop grows its words into a sheet where they stand, over its wire and the rows below, and moves no row. The sheet has one italic line, the place's summary, and the rest under labels in a margin, why, feel, light and look, in ink and muted alone. It ends with "map": a Google Maps link to the place by its name and city, or to a meal's area, and under it how far the map vouches for the place. A place the search confirmed carries a quiet crosshair after its kind and quarter in the row. A stop opens as soon as it is whole, while the day is still being written.

Choosing stays on the wire: the sheet tells the place and never picks a version. The sheet has no scroll of its own and makes the page taller only rarely, taking the room under the header and in the page's tail. On a laptop it is at least 448 px wide. The beads of the stop above stay whole over its edge.

### The end of a day and the foot

Under a finished day's last row, in both views, the day ends with what it is: "Home by quarter past eight · 8 stops · about 7.1 km on foot", then "3 of 8 places found on OpenStreetMap ⌖" on a day whose places were checked. Every number is worked out from the day as shown and the versions the visitor picked. Under the summary the day asks one quiet line, "Would you follow this day? Yes · Not quite", "Thank you." standing in its place once answered (`docs/decisions.md`, "A day's end asks one question, answered in one tap"). The ways to take the day along are the masthead's menu's; a page read without its script, which has no menu, keeps the walking route here as a plain link.

Every page ends with "Privacy and terms" and the support address, held at the foot of the screen on a short page. A day credits its sources in the same foot under a hairline, on its left, with Lantern's links on its right, and on a phone under those links. `/privacy` gives a short version first, then what Lantern keeps, why, who handles it, for how long, and the visitor's rights, in plain words true to the code.

### Endings

A stream that ends without a day says so in the header's notice, in place of the line about the day, with a way on in the same line. "Lantern couldn't finish this day. Write it again, or open one it has written:" for a day cut short or unreadable. "The connection dropped before Lantern finished this day." with the same way on. "Lantern can't plan this day. Open one it has written:" for a refusal, with no retry, since the same request would most likely be declined again. The chart fades as one piece, gone to the eye in about 217 ms, then the pen writes the notice. A screen reader hears it once. On a written day's own page, a play that ends without the day shows the day whole instead.

### On a phone

The phone is where a day is used: in the street, one hand, in sunlight, tired. The day screen serves that glance first.

- A stop's words always stay a column beside their bead, however narrow.
- The energy scale's words are held at the screen's top while the chart is in view. Once the day differs from its plan they say how, "livelier in the afternoon", with "Back to the plan".
- For two seconds after a swap or a drag, the header's growth scrolls the page, so the chart under the finger holds still.
- The line about the day is a size down, and the room for the curve's clause is taken when it comes, after the finger lifts.
- A word's open list stands over the scale's band, moved into the screen. The city's field is large enough that Safari does not zoom to it.
- A fork's parts are usually below the screen, so the facts line says what the fork does, "Writing “eating late” for lunch and dinner · see it at 13:15", and "see it at" scrolls there on a press. Nothing scrolls by itself.

### On a large screen

From 1440 px wide, the root's size grows with the viewport to a quarter more at 2560 px, and every rem with it: the page's column, the chart, the type and the icons. The chart's drawing grows by that growth alone. The visitor's own text size never grows the drawing, because a phone has little width. A finished day's frame ends on the whole hour after its last visit, not the hour asked, so no empty tail hangs under it.

## How the look was found

- **The layout.** Three concepts on one Kyoto day: time as an elastic ruler, which read as a calendar; energy lanes, chosen; and light as the layout. The lanes then read as a document with a remote control, the slider apart from a day that only reflowed, so the day became one energy-by-time chart.
- **The chart.** Four ways to draw it: the abacus; lanes with tick marks, which hid the options until a stop was opened; a river ribbon, lumpy once drawn; and a quiet baseline, clear but with nothing to remember. Only the abacus shows the model's whole option space and the code's pick at once.
- **The open stop.** Choosing a version inside an open stop, and pushing the day apart to show it, repeated what the wire already does and broke the picture of the day. A margin note was tried and set aside for the words opening in place.
- **A lighter day.** A phone day of a time, a name and a dot at rest, 32 marks against 85, was drawn and kept only as a reserve. The owner kept every version on its wire at rest.
- **The type.** A serif, a grotesk and monospace capitals read as generated. One sans replaced all three.
- **The palette.** Sage, an olive ground, read as a brown stain under amber, and its amber and olive were 4 to 8 ΔE2000 apart for colour-blind eyes, so the sun and the curve looked alike to about one man in twelve. A cool first pass read pale and cold, "not a lantern" in the owner's words. Night market won the second pass.
- **Light.** A light radar, dragging the sun across the chart, answered only someone who drags. Bands of golden hour, blue hour and night across the chart read heavy in both themes. Light moved onto the time axis.
- **The demonstration.** The curve once pulled itself to show what it does. It retired with the rule that the page never changes the day by itself; a ring and a dashed example took its place.
- **The start screen.** A sentence with a blank told someone new nothing. A finished day under the question loaded the first screen with a day before any press. The question with written cities, and no day, came next, then the quick starts, each a day in its city in Lantern's words, its country under it and its day's shape beside it, under "Or watch Lantern write a day it knows". They were set aside for the index, a second way in of one weight with the question, and a day's first stops shown still under it.
- **The masthead.** The wordmark at the voice's size on the left and, on the right, "Plan another day" underlined before the theme's icon, the ways to take a day along in a line under its last stop: "Copy link · Add to calendar · Walk it in Google Maps · Plan another day". The ways stood where someone following the day does not look, so they moved into the day's menu at the screen's top right, and the wordmark took the body's size.
- **The list's versions.** On the list a stop's versions once stood in a line under it, "or Konchi-in quieter · Ginkaku-ji Approach livelier", each pressed in place. The plan's carousel replaced it: the stop itself swipes, and the wire's order sets the sides.
- **The chart first.** A day once opened on the chart, the list one press away for those who wanted words. A first-time visitor had to learn the chart's encoding before reading their day, so the plan came first, the light carried on its rail.
- **The index's pictures.** Placeholder squares beside each line came first. Three styles for a mood or an occasion read as decoration; real landmarks in a monoline drawing, set on one ground at one optical size and one weight with a low sun beside each, read as clip-art, in a list, on cards or along one horizon. A thinner line traced to one pixel weight, an architect's elevation and an urban sketcher's ink were tried on two cities; the engraving won. A landmark gave way to a city's everyday thing. For the dark theme a clean plate in a dimmer ink read faded, a scratchboard cut for the dark needed a second drawing out of register with the first, and a paper plate put back the backing the grid had shed; layers cut from one scene took their place.
- **Hover.** Links once turned energy's green under the pointer, which said energy where none was meant; their rule now goes twice as heavy. An index cell pointed at once stepped the other engravings back to 40%, which flashed the grid at each move and faded seven pictures to show one; every engraving now rests at 90% where a pointer can hover, and the one pointed at comes up to full.
- **The re-plan.** A changed word once struck the old stops through and let new ones give way to them one by one, with Keep, Undo and Redo. The fork replaced it, for the reasons above.
