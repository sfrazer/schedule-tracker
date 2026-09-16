#!/bin/sh
# Stamp ?v=<content hash> onto asset links in index.html so browsers fetch
# changed files instead of reusing cached copies. Run by the pre-commit hook.
set -e
cd "$(dirname "$0")/.."

for f in style.css config.js app.js; do
  v=$(git hash-object "$f" | cut -c1-8)
  # Matches "style.css" or "style.css?v=abc12345" inside href/src attributes.
  perl -pi -e "s#\"\Q$f\E(\?v=[0-9a-f]*)?\"#\"$f?v=$v\"#g" index.html
done
