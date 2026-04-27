.[] | select(.paper.id=="2604.22748") | .paper |
"ID: \(.id)\nTitle: \(.title)\nPublished: \(.publishedAt)\nUpvotes: \(.upvotes)\nAuthors: \([.authors[].name] | join(\", \"))\n---\nSummary:\n\(.summary)\n---\nAI Summary:\n\(.ai_summary // \"none\")"
