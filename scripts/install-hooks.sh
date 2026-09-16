#!/bin/sh
# Install the pre-commit hook that keeps asset versions in index.html current.
set -e
cd "$(dirname "$0")/.."
cat > .git/hooks/pre-commit <<'HOOK'
#!/bin/sh
scripts/stamp-assets.sh
git add index.html
HOOK
chmod +x .git/hooks/pre-commit
echo "Installed .git/hooks/pre-commit"
