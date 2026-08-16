import os

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content

    if 'method: "POST"' not in content:
        return

    # Add import at the top
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import_idx = i
    
    if last_import_idx != -1:
        lines.insert(last_import_idx + 1, 'import { fetchWithCSRF } from "@/lib/csrf";')
    else:
        lines.insert(0, 'import { fetchWithCSRF } from "@/lib/csrf";')

    content = '\n'.join(lines)

    # Now, find all indices of `method: "POST"`
    idx = content.find('method: "POST"')
    while idx != -1:
        # Backtrack to find the nearest `fetch(`
        fetch_idx = content.rfind('fetch(', 0, idx)
        if fetch_idx != -1:
            # Replace `fetch(` with `fetchWithCSRF(`
            content = content[:fetch_idx] + 'fetchWithCSRF(' + content[fetch_idx+6:]
            # Since we added 8 chars ("WithCSRF"), adjust the search index
            idx += 8
        idx = content.find('method: "POST"', idx + 14)

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Patched CSRF in {filepath}")

for root, dirs, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            process_file(os.path.join(root, file))
