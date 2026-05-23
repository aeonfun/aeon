#!/bin/bash
exec jq --argjson tr '["UDS","HYPE","BTC","NEAR","SUI","ZEC","GRASS","SOL","VVV","SKYAI","LIT","NEX","TAO","LUNC","AKT"]' \
        --argjson dd '["KAIA","TRAC","BSB","INJ","NEAR","HYPE","CHZ","LIT","VVV","DASH","ZEC","PENGU","GRASS","ONDO","WLD","BEAT","GENIUS"]' \
        --argjson btc7d -4.684399072141677 \
        --argjson eth7d -7.610946646112369 \
        -f .outputs/_tc-score.jq .outputs/_tc-markets.json
