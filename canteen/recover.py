import os
from bs4 import BeautifulSoup
import re

BASE_DIR = '/Users/gaurangkumawat/Desktop/medicanteen/canteen'
TEMPLATE_DIR = os.path.join(BASE_DIR, 'accounts', 'templates')
STYLE_CSS_PATH = os.path.join(BASE_DIR, 'static', 'css', 'style.css')

with open(STYLE_CSS_PATH, 'r', encoding='utf-8') as f:
    css_content = f.read()

# style.css contains blocks separated by \n\n
blocks = css_content.split('\n\n')
# Clean blocks
blocks = [b.strip() for b in blocks if b.strip() and not b.startswith('/* Automatically')]

html_files = []
for root, dirs, files in os.walk(TEMPLATE_DIR):
    for f in files:
        if f.endswith('.html'):
            html_files.append(os.path.join(root, f))

found_styles = []
for file_path in html_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        html_content = f.read()
    soup = BeautifulSoup(html_content, 'html.parser')
    for style_tag in soup.find_all('style'):
        if style_tag.string:
            found_styles.append(style_tag.string.strip())

# Which blocks from style.css are NOT in found_styles?
missing_blocks = []
for b in blocks:
    matched = False
    for fs in found_styles:
        if fs.strip() == b.strip():
            matched = True
            break
    if not matched:
        missing_blocks.append(b)

print(f"Total blocks in style.css: {len(blocks)}")
print(f"Missing blocks to recover: {len(missing_blocks)}")

for i, mb in enumerate(missing_blocks):
    print(f"--- MISSING BLOCK {i} (length: {len(mb)}) ---")
    print(mb[:200] + "...")
