#!/usr/bin/env bash
set -e
for eid in 357625 357807 30829 119296 36173; do
  curl -s "https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=${eid}&limit=20&order=reactionCount&ascending=false" -o ".outputs/cmt_top_${eid}.json"
  curl -s "https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=${eid}&limit=15&order=createdAt&ascending=false" -o ".outputs/cmt_new_${eid}.json"
  topn=$(jq 'length' ".outputs/cmt_top_${eid}.json")
  newn=$(jq 'length' ".outputs/cmt_new_${eid}.json")
  echo "${eid}: top=${topn} new=${newn}"
done
