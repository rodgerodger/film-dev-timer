# Soup — home film developing timer

Step-by-step developing timer for **C-41**, **ECN-2** and **black & white** film.

Open `index.html` in a browser (no build step, works offline), or serve it:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

## Features
- Pick process → film → kit / developer, push/pull, B&W temperature compensation
- Chemistry age: date mixed + rolls already developed extend the developer time (rates editable per kit)
- Chemistry log remembered per kit (localStorage); log rolls at the end of a session
- Editable step list, optional steps (pre-wash, stabilizer, wetting agent…)
- Large countdown with agitation & "start draining" cues, beeps, vibration, optional voice
- Screen wake lock, °C/°F, red darkroom mode, keyboard (Space / ← / →)

## Data
All film/kit times live in `js/data.js`. They are starting points — verify against your kit and film datasheets.
