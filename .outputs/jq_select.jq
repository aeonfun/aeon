.[]
| select(
    .paper.id == "2512.16030"
 or .paper.id == "2601.13545"
 or .paper.id == "2505.17989"
 or .paper.id == "2509.22638"
 or .paper.id == "2512.25070"
 or .paper.id == "2510.02209"
 or .paper.id == "2502.11433"
 or .paper.id == "2511.07678"
)
| "\n=== \(.paper.id) ===\nTitle: \(.paper.title)\nDate: \(.paper.publishedAt[:10])  Upvotes: \(.paper.upvotes // 0)\nAuthors: \([.paper.authors[].name] | join(", "))\nAbstract: \(.paper.summary)"
