#!/bin/bash
for f in .outputs/pp-phd-*-0503.json; do
  topic=$(basename "$f" .json | sed 's/pp-phd-//;s/-0503//')
  jq -r --arg t "$topic" '.[] | "\($t) | \(.paper.publishedAt[0:10]) | up\(.paper.upvotes) | \(.paper.id) | \(.paper.title[0:95])"' "$f" 2>/dev/null
done | sort -u | sort -t'|' -k2,2r -k3,3 | head -80
