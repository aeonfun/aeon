# Nipmod bridge review

This is a review draft for connecting Aeon workflows with Nipmod.

Nipmod is a shared package archive for agents. It exposes package metadata, source links, trust evidence and install plans so agents can inspect packages before using them.

## What this adds

- `skills/nipmod/SKILL.md`
- a read-only package search and trust check workflow for Aeon operators
- a safe install-plan step before external package use
- links back to the public Nipmod registry and hosted MCP endpoint

## What it does not do

- it does not auto-install packages
- it does not execute third-party code
- it does not use secrets or credentials
- it does not transfer funds
- it does not claim Aeon endorsement of Nipmod

## Nipmod side

Nipmod has a review packet for a first Aeon skill collection:

https://nipmod.com/aeon

Draft collection:

https://nipmod.com/integrations/aeon/aeon.collection.json

Review packet:

https://nipmod.com/integrations/aeon/AEON_SUBMISSION.md

## Review asks

- confirm whether this skill belongs in Aeon
- confirm preferred naming
- confirm whether the first Aeon collection should be separate packages or a grouped collection
- confirm whether any Aeon skills should be excluded before publication through Nipmod
