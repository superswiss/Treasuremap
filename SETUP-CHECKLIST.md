# Information needed for your real-world hunts

Send the following in chat, or use it to fill content/hunt-settings.json. One adventure can be configured before the other. Decimal coordinates from a dropped map pin are ideal; all example points must be replaced with approved real locations.

## Operation Howell Creek

| Spot | Information needed |
| --- | --- |
| SNAVE Estates | Where Commander Evans will hand out agent badges and deliver the opening briefing |
| Nosy T Security Center | Coordinates and actual fence color: Black, White, Brown, or Green |
| Lake Mystery | Coordinates for the observation point and placement of the Acidic Quantum Fluid vial among the old equipment props |
| Pool staging point | Coordinates for a safe starting area |
| Sensor Alpha | Coordinates for its safe capture position |
| Sensor Bravo | Coordinates for its safe capture position |
| Sensor Charlie | Coordinates for its safe capture position |
| Pool control switch | Placement for the freestanding prop and its hidden confirmation clue |
| The Enzone / treasure | Coordinates and where the final marker/treasure will be placed |
| Audio signal | Speaker placement, or a decision to use WAV upload only |

### Agent badges

- [ ] Confirm each player's agent name and make one badge per player with an embedded NFC tag.
- [ ] Program each tag with a personalized link to the deployed game. When an agent taps their badge, the site should open the mission start and read their agent name aloud.
- [ ] Test each badge on the phones the players will use. Verify that the correct name is spoken and the game opens at the start.

### Lake Mystery vial

- [ ] Fill a small, leakproof plastic vial with white vinegar. Make one per team and apply the **Acidic Quantum Fluid** label from the transmission script. The label identifies the fluid and explains that it can damage the datacenter's quantum controller and shut down the system.
- [ ] Stage the sealed vial among old equipment props at the marked Lake Mystery observation point. Verify that agents can spot and retrieve it from the path.

### Pre-pool cooling station markers

- [ ] Provide a distinct AR marker image for Nosy T Security Center.
- [ ] Provide a distinct AR marker image for Lake Mystery.

### Pool control switch

- [ ] Build a freestanding switch for the agents to disable after STEVE's reveal. Place it at the pool checkpoint away from the water and pool equipment.
- [ ] Test that the vinegar carried from Lake Mystery produces a clear color reveal when poured into the switch's open cup of baking soda and food coloring. Set the switch in a spill tray.
- [ ] Set the game's confirmation question and answer to match what the prop reveals. The current color choices are Blue, Green, Purple, and Red, with Blue configured.
- [ ] Test that the clue stays hidden until the agents disable the switch, is easy to read outdoors, and can be reset for the next team.

Also confirm:

- Keep **180 seconds** for the sensor sweep? It can be set from 30 to 900 seconds.
- Start with **35 meters** for arrival and **18 meters** for sensor capture? Tune after testing.
- Keep shutdown phrase **TRUST YOUR TEAM**? The three journal fragments automatically follow the configured phrase.
- Keep organizer PIN **1980**? Change it locally if desired. It is a convenience PIN, not secure authentication.

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
SNAVE Estates badge handout spot / agent names:
Security coordinates / fence color:
Lake Mystery coordinates / vial placement:
Pool start coordinates:
Alpha coordinates:
Bravo coordinates:
Charlie coordinates:
Pool control switch coordinates / effect / confirmation answer:
Treasure coordinates / final marker placement:
Timer (default 180 sec):
Shutdown phrase (default TRUST YOUR TEAM):
Audio playback plan:

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

