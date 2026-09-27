# FlowForge: The Factory Optimization Game 

**Watch the Youtube Demo Video** => https://www.youtube.com/watch?v=4-MvPp1RSe4

Place conveyor belts. Route packages. Survive the surge. Learn systems thinking through hands-on factory puzzles.

FlowForge is a browser-based educational puzzle game that teaches factory operations concepts such as flow, bottlenecks, conditional routing, and load balancing through short, focused conveyor-building levels. Built for the IBM BOB 2.0 Hackathon.

## How to Play

1. Read the Mission Brief for your level.
2. Select a component from the left toolbar and place it on the grid.
3. Press `R` to rotate before placing, right-click to erase.
4. Press **Run** (or `Space`) to start the simulation.
5. Watch packages flow from the spawner to the output collector(s).
6. Get your star rating and a coaching report from Bob the Foreman.
7. Retry to improve your score, or advance to the next level.

## Levels

| Level | Name | Concept | Win Condition |
|---|---|---|---|
| 1 | Straight Line Basics | Flow direction & belt placement | 100% delivered, zero blocked |
| 2 | The Bottleneck | Throughput vs. capacity | ≥85% delivered, <4 blocked |
| 3 | Fragile Cargo | Conditional routing (Sorter) | 0 broken fragile, ≥80% delivered |
| 4 | Peak Load Challenge | Load balancing under a spike | ≤6 blocked, ≥75% delivered |

## Components

- **Straight Belt** — moves packages in one direction, rotatable.
- **Turn Belt** — redirects packages 90° counter-clockwise.
- **Buffer** — holds up to 4 packages, releases one every 2 ticks.
- **Sorter** — routes fragile packages to an alt exit, others go straight.
- **Sensor** — counts packages crossing it.
- **Weight Station** — flags and slows heavy packages by 2 ticks.
- **Input Spawner / Output Collector** — fixed per level.

## Simulation Engine

FlowForge runs on a discrete tick-based engine. Each tick, active spawners generate packages, and every live package advances one cell based on the component it occupies. Packages that can't move accumulate wait ticks and are marked blocked once a threshold is exceeded. Delivered, blocked, and broken packages are tracked as live metrics throughout the run.

## Bob the Foreman

After every run, Bob the Foreman (the in-game AI mentor) generates a three-sentence coaching report grounded in that run's actual metrics — what happened, the root cause tied to the level's core concept, and a concrete suggestion for the next attempt. Press **Hint** during a level for a smaller, rotating nudge.

## Scoring

Each level awards 1–3 stars based on delivery rate, blocked count, and tick efficiency. Best scores persist via local storage.

## Built With

- IBM Bob (full application build)
- Discrete tick-based simulation engine
- HTML5 Canvas grid rendering
- Local storage for progress persistence

## Background

This project builds on prior independent work developing a terminal-based conveyor simulator in Java for an Object-Oriented Programming university course, which explored abstraction, inheritance, polymorphism, exception handling, and rule-based composition in a discrete-event conveyor domain. FlowForge adapts that same conveyor/simulation core into an interactive, game-first educational product for the IBM BOB 2.0 Hackathon.

## Team

Leonhard Satria