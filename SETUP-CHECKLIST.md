# Information needed for your real-world hunts

Send the following in chat, or use it to fill content/hunt-settings.json. One adventure can be configured before the other. Decimal coordinates from a dropped map pin are ideal; all example points must be replaced with approved real locations.

## Operation Howell Creek

| Spot | Information needed |
| --- | --- |
| Starting point | Where the activation QR/NFC marker will be placed; GPS is not required here |
| Nosy T Security Center | Coordinates and actual fence color: Black, White, Brown, or Green |
| Pool staging point | Coordinates for a safe starting area |
| Sensor Alpha | Coordinates for its safe capture position |
| Sensor Bravo | Coordinates for its safe capture position |
| Sensor Charlie | Coordinates for its safe capture position |
| Processor prop | Coordinates and indicator color: Blue, Green, Purple, or Red |
| The Enzone / treasure | Coordinates and where the final marker/treasure will be placed |
| Audio signal | Speaker placement, or a decision to use WAV upload only |

Also confirm:

- Keep **180 seconds** for the sensor sweep? It can be set from 30 to 900 seconds.
- Start with **35 meters** for arrival and **18 meters** for sensor capture? Tune after testing.
- Keep shutdown phrase **TRUST YOUR TEAM**? The three journal fragments automatically follow the configured phrase.
- Keep organizer PIN **1980**? Change it locally if desired. It is a convenience PIN, not secure authentication.
- Add **Lake Mystery** or **Snave Estates**? Their actual locations and puzzles were not in the supplied material, so this version does not invent stops for them.
- Which prepared colored prop will players inspect? The app avoids chemical handling and real pool equipment.

## Captain Barnacle Beard

The original real coordinates and questions were absent from the summaries. For each of five stops, provide:

```text
Stop number:
Landmark / title:
Latitude:
Longitude:
Question:
Answer choices (2–6):
Correct answer (must match a choice):
Optional story text / riddle:
Optional hints:
```

Also supply the final treasure coordinates, marker placement, and confirmation the stops are approved and accessible for your group. Current pirate questions are explicitly demo content, not verified resort landmarks.

## Players and physical setup

- Ages, group size, one shared phone or independent phones?
- Desired route length/duration and accessibility needs?
- Which phone/browser will you use for the outdoor test?
- QR labels, NFC tags, or both?
- Physical treasure box, organizer handoff, or another reward?
- Separate speaker/playback phone for the audio clue, or file upload only?

This version saves independently on each device. Progress codes transfer a team’s save; they do not synchronize multiple phones.

## Deployment

Provide your GitHub username and desired repository name if you want help with exact URLs, or a link to an existing game repository. Demos can be published immediately while real hunts remain locked pending setup. See README.md for the complete deployment process.

## Copy-and-paste reply

```text
Adventure to finish first:
Player ages / group size / shared or independent phones:
Target duration / accessibility needs:

HOWELL
Security coordinates / fence color:
Pool start coordinates:
Alpha coordinates:
Bravo coordinates:
Charlie coordinates:
Processor coordinates / indicator color:
Treasure coordinates / final marker placement:
Timer (default 180 sec):
Shutdown phrase (default TRUST YOUR TEAM):
Audio playback plan:
Add Lake Mystery / Snave Estates? Location and puzzle idea:

PIRATE
Stop 1 coordinates / question / choices / answer:
Stop 2 coordinates / question / choices / answer:
Stop 3 coordinates / question / choices / answer:
Stop 4 coordinates / question / choices / answer:
Stop 5 coordinates / question / choices / answer:
Treasure coordinates / marker placement:

DEPLOYMENT
GitHub username / repository name:
Publish demos before final route setup?:
```

