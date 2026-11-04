#!/usr/bin/env python3
"""Assemble index.html from the parts in src/. Run: python3 build.py"""
from pathlib import Path
SRC = Path(__file__).parent / "src"
parts = ["head.html", "lab.css", "markup.html"]
scripts = ["a-core.js", "b-routing-scene.js", "c-scenarios-3d.js", "d-scenarios-lab.js", "e-results-input.js"]
html = "".join((SRC / p).read_text(encoding="utf-8") for p in parts)
js = "".join((SRC / p).read_text(encoding="utf-8") for p in scripts)
html += '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>\n' + js + "</script>\n"
out = Path(__file__).parent / "index.html"
out.write_text(html, encoding="utf-8")
(Path(__file__).parent / "tests" / "_bundle.js").write_text(js, encoding="utf-8")
print(f"wrote {out} ({len(html.encode('utf-8'))} bytes)")
