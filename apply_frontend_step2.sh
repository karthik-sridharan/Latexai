#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$REPO_ROOT"

if [ ! -f index.html ]; then
  echo "ERROR: index.html not found. Run this from your Latexai repo root or pass repo root path."
  exit 1
fi

mkdir -p js
cp "$SCRIPT_DIR/js/lai-storage-provider-preload.js" js/lai-storage-provider-preload.js
cp "$SCRIPT_DIR/js/lai-storage-ui.js" js/lai-storage-ui.js

python3 - <<'PY'
from pathlib import Path

path = Path('index.html')
html = path.read_text(encoding='utf-8')

provider_tag = '<script src="js/lai-storage-provider-preload.js?v=latex-stage2a-storage-foundation-20260518-1"></script>'
ui_tag = '<script src="js/lai-storage-ui.js?v=latex-stage2a-storage-ui-20260518-1"></script>'

changed = False

if 'js/lai-storage-provider-preload.js' not in html:
    # Put storage provider after compiler provider preload if present, otherwise before first local js script, otherwise before </head>.
    marker_candidates = [
        '</script>\n<script src="js/compiler-provider-preload.js',
        '<script src="js/compiler-provider-preload.js',
    ]
    inserted = False
    if 'js/compiler-provider-preload.js' in html:
        # Insert after the compiler provider preload script tag.
        idx = html.find('js/compiler-provider-preload.js')
        end = html.find('</script>', idx)
        if end != -1:
            end += len('</script>')
            html = html[:end] + '\n' + provider_tag + html[end:]
            inserted = True
    if not inserted:
        first_js = html.find('<script src="js/')
        if first_js != -1:
            html = html[:first_js] + provider_tag + '\n' + html[first_js:]
            inserted = True
    if not inserted:
        head_end = html.find('</head>')
        if head_end != -1:
            html = html[:head_end] + provider_tag + '\n' + html[head_end:]
            inserted = True
    if not inserted:
        html += '\n' + provider_tag + '\n'
    changed = True

if 'js/lai-storage-ui.js' not in html:
    # UI should load near the end of body, after app scripts.
    body_end = html.rfind('</body>')
    if body_end != -1:
        html = html[:body_end] + ui_tag + '\n' + html[body_end:]
    else:
        html += '\n' + ui_tag + '\n'
    changed = True

if changed:
    path.write_text(html, encoding='utf-8')
    print('Patched index.html with Step 2 storage scripts.')
else:
    print('index.html already contains Step 2 storage scripts.')
PY

echo "Copied Step 2 frontend files:"
echo "  js/lai-storage-provider-preload.js"
echo "  js/lai-storage-ui.js"
echo
echo "Next:"
echo "  git add index.html js/lai-storage-provider-preload.js js/lai-storage-ui.js"
echo "  git commit -m 'Add Latexai storage foundation and local folder autosave'"
echo "  git push"
