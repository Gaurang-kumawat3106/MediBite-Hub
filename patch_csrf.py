import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original_content = content

    if 'method: "POST"' not in content:
        return

    # Skip if already patched
    if 'import { getCSRFToken }' in content:
        return

    # Add import at the top
    # Find the last import statement
    lines = content.split('\n')
    last_import_idx = -1
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import_idx = i
    
    if last_import_idx != -1:
        # Check depth for relative import if alias doesn't work, but Next.js usually supports @/
        lines.insert(last_import_idx + 1, 'import { getCSRFToken } from "@/lib/csrf";')
    else:
        lines.insert(0, 'import { getCSRFToken } from "@/lib/csrf";')

    content = '\n'.join(lines)

    # Now we need to inject the token fetch before fetch(..., { method: "POST"
    # This regex is tricky, but we can do a simpler replacement
    # We'll replace `const res = await fetch(` with:
    # `const csrfToken = await getCSRFToken();
    #  const res = await fetch(`
    # But only for POST requests.
    
    # Let's find all fetch blocks
    # We will use regex to find `fetch(..., { ... method: "POST" ... })`
    
    # A safer way: just replace `const res = await fetch(` with `const csrfToken = await getCSRFToken();\n      const res = await fetch(`
    # But wait, some are `await fetch(` without `const res`.
    
    parts = content.split('await fetch(')
    new_parts = [parts[0]]
    
    for part in parts[1:]:
        if 'method: "POST"' in part[:300]:  # Look ahead in the next 300 chars
            # It's a POST fetch!
            # Insert the CSRF header and credentials
            
            # 1. Add headers: { "X-CSRFToken": csrfToken }
            # If headers: { already exists
            if 'headers: {' in part[:300]:
                part = part.replace('headers: {', 'headers: {\n          "X-CSRFToken": csrfToken,', 1)
            else:
                # Add headers block
                part = part.replace('method: "POST",', 'method: "POST",\n        headers: {\n          "X-CSRFToken": csrfToken\n        },', 1)
            
            # 2. Add credentials: "include" if not exists
            if 'credentials: ' in part[:300]:
                part = re.sub(r'credentials:\s*"(omit|same-origin)"', 'credentials: "include"', part, count=1)
            else:
                part = part.replace('method: "POST",', 'method: "POST",\n        credentials: "include",', 1)

            new_parts.append('getCSRFToken().then(csrfToken => fetch(' + part)
            # Wait, using .then() is safer because we don't know if we're inside an expression
            # Let's use an IIFE to be safe: `(await (async () => { const csrfToken = await getCSRFToken(); return fetch(...); })())`
        else:
            # Check if it needs credentials: "include" for GET requests
            if 'credentials: ' in part[:300]:
                pass
            else:
                if 'method: "GET"' in part[:300] or 'method:' not in part[:100]:
                    part = part.replace('headers: {', 'credentials: "include",\n        headers: {', 1)
            new_parts.append('await fetch(' + part)

    # Rejoin
    content = "".join(new_parts)

    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Patched CSRF in {filepath}")

for root, dirs, files in os.walk('frontend/src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            process_file(os.path.join(root, file))
