#!/bin/bash
# Create a new blog post JSON file.
# Usage: bash new-post.sh "文章标题" "研究笔记"

set -e

TITLE="${1:?Please provide a post title: bash new-post.sh 'Title' 'Category'}"
CATEGORY="${2:-研究笔记}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
POSTS_DIR="$SCRIPT_DIR/posts"

mkdir -p "$POSTS_DIR"

SLUG=$(printf '%s' "$TITLE" |
  tr '[:upper:]' '[:lower:]' |
  sed 's/[^a-zA-Z0-9]/-/g' |
  sed 's/--*/-/g' |
  sed 's/^-//' |
  sed 's/-$//' |
  cut -c 1-60)

if [ -z "$SLUG" ] || ! printf '%s' "$SLUG" | grep -q '[a-z]'; then
  SLUG="post-$(date '+%Y%m%d')"
fi

DATE=$(date '+%Y-%m-%d')
FILENAME="$POSTS_DIR/${SLUG}.json"

if [ -f "$FILENAME" ]; then
  SLUG="${SLUG}-$(date '+%H%M%S')"
  FILENAME="$POSTS_DIR/${SLUG}.json"
fi

cat > "$FILENAME" << EOF
{
  "slug": "$SLUG",
  "title": "$TITLE",
  "date": "$DATE",
  "category": "$CATEGORY",
  "excerpt": "在这里写文章摘要。",
  "content": "<h2>引言</h2>\\n<p>在这里开始写正文。</p>\\n"
}
EOF

echo "New post created: $FILENAME"
echo ""
echo "Next steps:"
echo "  1. Edit the generated JSON file."
echo "  2. Update excerpt and content."
echo "  3. Add the post metadata to posts/index.json."
echo "  4. Run bash serve.sh to preview."
