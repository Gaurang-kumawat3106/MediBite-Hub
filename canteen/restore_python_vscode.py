import os
import json
import shutil

HISTORY_DIR = '/Users/gaurangkumawat/Library/Application Support/Code/User/History'
PROJECT_DIR_BASE = '/Users/gaurangkumawat/Desktop/medicanteen/canteen/accounts'

latest_backups = {}

for root, dirs, files in os.walk(HISTORY_DIR):
    if 'entries.json' in files:
        entries_path = os.path.join(root, 'entries.json')
        try:
            with open(entries_path, 'r') as f:
                data = json.load(f)
            
            resource = data.get('resource', '')
            if resource.endswith('views.py') or resource.endswith('urls.py'):
                file_name = os.path.basename(resource)
                
                # Check if it belongs to our project accounts app
                if '/accounts/' not in resource:
                    continue
                
                entries = data.get('entries', [])
                if entries:
                    latest_entry = max(entries, key=lambda x: x.get('timestamp', 0))
                    backup_file_path = os.path.join(root, latest_entry['id'])
                    
                    if file_name not in latest_backups or latest_entry['timestamp'] > latest_backups[file_name]['timestamp']:
                        latest_backups[file_name] = {
                            'timestamp': latest_entry['timestamp'],
                            'backup_path': backup_file_path,
                            'resource_path': resource
                        }
        except Exception as e:
            continue

print(f"Found {len(latest_backups)} Python files in vscode history.")
for fname, info in latest_backups.items():
    print(f"Restoring {fname} (timestamp: {info['timestamp']})")
    
    dest_path = os.path.join(PROJECT_DIR_BASE, fname)
    
    if os.path.exists(info['backup_path']):
        shutil.copy2(info['backup_path'], dest_path)
        print(f"Successfully restored {fname}")
    else:
        print(f"Warning: backup {info['backup_path']} not found!")
