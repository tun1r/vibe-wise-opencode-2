# Local state templates

Create only these three files in the supplied state directory. Replace bracketed
values with evidence or “Not specified.” Keep status lines unformatted near the
top; the plugin reads them. Never replace existing state with a fresh template.

## profile.md

```markdown
# Learner Profile

Learning mode: active
Onboarding: complete

## Project
Situation: [New / Existing / Known]
Building: [project purpose]
Codebase familiarity: [answer]
Learning scope: [entire system / parts we touch / mixed]

## Experience
Overall programming: [Beginner / Intermediate / Advanced, or Not specified]
Stack familiarity: [per-technology levels or Not specified]

## Goals
Primary: [answer]
Capability goal: [optional answer]

## Preferences
Checkpoint frequency: Normal
Question style: Open-ended
Implementation style: AI writes code

## Strong Concepts
No demonstrated understanding recorded yet.

## Developing Concepts
None recorded yet.

## Revisit
None recorded yet.
```

## progress.md

```markdown
# Learning Progress

No learning events recorded yet.
```

As learning occurs, add `## Topic` sections with concise bullets under Introduced,
Demonstrated understanding, and Needs reinforcement. Record reasoning evidence,
not transcripts. Product preferences are requirements, not evidence of engineering
understanding. Keep learner reasoning distinct from AI explanations. Consolidate
entries; each topic must be independently readable.

While waiting on a checkpoint, keep a short section headed exactly
`## Pending decision`, not in a topic, with the proposal, awaited reply, decision
name and stage: awaiting reasoning, choice confirmation, or implementation approval.
Remove once resolved; record outcome in the map as chosen or implemented, label
approved additions as the AI's, and put reasoning evidence in its topic. Do not
move pending text into a topic. Record confirmed choices without claiming they're
implemented. Keep proposed coding scope explicit. Confirmation covers only the
presented proposal. Never append unstated fields, behaviors, alternatives, or
reasons to the chosen design. Mark unresolved details unknown and suggestions
proposed; don't attribute them to the learner.

## project-map.md

```markdown
# Project Map

## Purpose
[What this software does.]

## Requirements
[User needs and constraints; these don't automatically settle technical choices.]

## Components
[Components, responsibilities, and supporting file paths.]

## Main Flow
[Compact diagram. Mark unknowns and distinguish proposed, chosen, implemented.]

## Data and Trust Boundaries
[Storage, ownership, auth, external services; unknown when unverified.]

## Build and Deployment
[Commands and configuration paths verified in the repository.]

## Unknowns
[Unresolved choices and what needs inspection.]
```
