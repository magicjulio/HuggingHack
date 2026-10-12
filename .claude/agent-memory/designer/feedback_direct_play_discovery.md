---
name: feedback-direct-play-discovery
description: Julius wants puzzles played directly in the 3D room (no pop-up windows) and stations discovered one at a time in a dark room; wants a short plan before big work
metadata:
  type: feedback
---
Julius, 2026-10-12, on the ch1 stations:
- Play puzzles directly in 3D wherever possible: drag real 3D wires, shoot bugs on the in-world monitor, decode on the terminal screen. A window is OK only when it really helps (the grep log search terminal).
- The room was "too bright right away". The player should discover the stations one after another: dark room, each station wakes with its own light.
- He changed his mind mid-task from "keep the row" to "spread them around". Expect layout calls to move, so keep positions in one table (room.py `STATIONS`, hub `LAYOUT`).
- He asked "shortly propose the plan before you start": for a multi-asset job, post a short plan (a table of props + how they play + questions) and wait for a go.

**Why:** fewer windows opening and closing, a stronger sense of place and discovery.

**How to apply:** for every new prop, ask "can this be played on the object itself?" and give the engineer node contracts (named empties for anchors, sockets and seats) plus a reference rig in the hub. Related: [[feedback-show-progress]], [[feedback-visual-quality]].
