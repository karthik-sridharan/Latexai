#!/usr/bin/env bash
set -euo pipefail

if [ ! -f index.html ]; then
  echo "ERROR: Run this from the Latexai repository root, where index.html exists." >&2
  exit 1
fi

mkdir -p js
cp "$(dirname "$0")/js/compiler-provider-preload.js" js/compiler-provider-preload.js
cp "$(dirname "$0")/js/compiler-provider.js" js/compiler-provider.js

python3 - <<'PY'
from pathlib import Path
p = Path('index.html')
s = p.read_text(encoding='utf-8')
script = '<script src="js/compiler-provider-preload.js?v=stage1h2-compilerprovider-preload-1"></script>'
if 'compiler-provider-preload.js' not in s:
    # Must be before app scripts so any local `const NS = window.LuminaLatex || {}` captures this object.
    idx = s.lower().find('<script')
    if idx >= 0:
        s = s[:idx] + script + '\n' + s[idx:]
    else:
        idx = s.lower().rfind('</body>')
        if idx >= 0:
            s = s[:idx] + script + '\n' + s[idx:]
        else:
            s += '\n' + script + '\n'
    p.write_text(s, encoding='utf-8')
    print('Injected compiler-provider-preload.js into index.html')
else:
    print('index.html already includes compiler-provider-preload.js')
PY

echo "\nChanged files:"
echo "  index.html"
echo "  js/compiler-provider-preload.js"
echo "  js/compiler-provider.js"
echo "\nNow run:"
echo "  git add index.html js/compiler-provider-preload.js js/compiler-provider.js"
echo "  git commit -m 'Preload CompilerProvider for Cloud Run TeX Live backend'"
echo "  git push"
echo "\nThen open:"
echo "  https://karthik-sridharan.github.io/Latexai/?v=stage1h2-compilerprovider-preload-1"
