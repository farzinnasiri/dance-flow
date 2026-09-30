# Dance Flow

A browser-based salsa timing trainer with a rotatable 3D dancer, recorded instrument samples, synchronized spoken counts, and leader/follower footwork.

Live site: https://salsa-follow.farzin-nasiri.chatgpt.site/

## Run locally

No dependencies or build step are required. Serve the static directory over HTTP:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000, then press Play. Browsers require a user gesture before audio starts. Sound files are included in `dist/audio`; nothing needs to be downloaded at runtime beyond these local assets.

## Tests

Use Node.js 22 or newer:

```sh
npm test
```

The tests cover all ten timings in both roles, replacement steps, loop closure, half counts, voice scheduling, and agreement between the count, highlighted beat, and dancer snapshot. Playback tests use simulated browser and audio interfaces; they do not replace visual browser or listening tests.

## Supported basics and timings

- Los Angeles On1
- Cuban Guapea On1
- New York / Eddie Torres On2
- Contratiempo On2
- On3 and On4
- Syncopated On2
- On clave, 2-side and strikes
- Cha-cha On2

Switch Lead/Follow to change the footwork. Timing, music, and step details expand within the page. Drag the dancer to rotate it, choose Back/Side/Front view, or use arrow keys while the canvas has focus. Home restores the back view. Space starts or pauses practice when an interactive control does not have focus.

The music controls offer Full band and Percussion presets, individual instrument switches, and an optional local song. For your own song, set its BPM and mark count 1 while it plays. Local songs are not uploaded.

## Code map

| File | Purpose |
| --- | --- |
| `dist/index.html` | Page structure and inline expandable controls |
| `dist/style.css` | Responsive practice layout and theme |
| `dist/app.js` | Controls, audio scheduling, and playback |
| `dist/steps.js` | Canonical closed footwork cycles and role mapping |
| `dist/timeline.js` | Periodic pose sampling and audio-output clock mapping |
| `dist/dancer.js` | Interactive 3D geometry rendered on a canvas |
| `dist/groove.js` | Original salsa arrangement and instructor break calls |
| `dist/audio/` | Recorded instrument and voice assets, with source credits |
| `tests/` | Timing, loop, and playback regression checks |
| `.openai/hosting.json` | Existing Sites project and static publishing configuration |

Foot positions are derived from a closed eight-count cycle. Replacement steps change the supporting leg without moving the planted soles. The dancer, count, and highlighted beat use the same timeline snapshot. Web Audio events use the matching origin, and the visual clock accounts for output latency when the browser exposes it.

## Audio credits and licenses

See [dist/audio/SOURCES.txt](dist/audio/SOURCES.txt) for every recording source and processing details. Instrument recordings are CC0. The adapted Jackson / Free Spoken Digit Dataset count recordings are CC BY-SA 4.0 and retain that license. Their attribution is also available within the app.

The practice arrangement is original. Salsa Beat Machine informed the instrument selection; its recordings are not included. Timing definitions follow the requested [Dance Dojo timing guide](https://thedancedojo.com/salsa-timing-on1-on2-on3/).

Repository: https://github.com/farzinnasiri/dance-flow

This repository does not grant a new license to the application source. Third-party audio retains its stated licenses.

## Publishing

Any static host can serve `dist/`. The supplied `.openai/hosting.json` references the existing private Sites project. Creating this GitHub copy does not enable automatic deployment from GitHub or change the live site's access.

Source snapshot: `0a633f2c4ba49e49d5dee1d2459b690dd0f10001`.
