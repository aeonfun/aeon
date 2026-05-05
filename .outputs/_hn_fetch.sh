#!/bin/bash
for id in 48019163 48019219 48017948 48017907 48016880 48019025 48017813 48013919 47990491 48019165 48018066 48015397; do
  curl -s "https://hacker-news.firebaseio.com/v0/item/${id}.json" -o ".outputs/_hn_${id}.json"
done
echo "done"
