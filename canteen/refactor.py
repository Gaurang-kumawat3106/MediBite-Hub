import os
import re

template_dir = 'accounts/templates'

for root, dirs, files in os.walk(template_dir):
    for file in files:
        if file.endswith('.html'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # 1. Remove all <style> blocks
            content = re.sub(r'<style>.*?</style>', '', content, flags=re.DOTALL)
            
            # 2. Remove all <script> blocks that don't have 'src='
            content = re.sub(r'<script(?![\s\S]*?src=)[^>]*>.*?</script>', '', content, flags=re.DOTALL)

            # 3. Inject {% load static %} if not present (must be at top AFTER {% extends %} if extends is present)
            if '{% load static %}' not in content:
                # If there's an extends tag, put load static right after it
                extends_match = re.search(r'^{%\s*extends[^%]+%}\s*', content, flags=re.MULTILINE)
                if extends_match:
                    content = content[:extends_match.end()] + '{% load static %}\n' + content[extends_match.end():]
                else:
                    content = '{% load static %}\n' + content

            # 4. Inject global CSS link before </head> if not present
            if 'css/style.css' not in content and '</head>' in content:
                link_tag = '    <link rel="stylesheet" href="{% static \'css/style.css\' %}">\n'
                content = content.replace('</head>', f'{link_tag}</head>')

            # 5. Inject global JS link before </body> if not present
            if 'js/main.js' not in content and '</body>' in content:
                script_tag = '    <script src="{% static \'js/main.js\' %}"></script>\n'
                content = content.replace('</body>', f'{script_tag}</body>')

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
                
print("Refactoring complete! All inline styles and scripts stripped.")
