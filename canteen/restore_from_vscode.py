import os
import json
import shutil
from pathlib import Path

HISTORY_DIR = '/Users/gaurangkumawat/Library/Application Support/Code/User/History'
PROJECT_DIR = '/Users/gaurangkumawat/Desktop/medicanteen/canteen/accounts/templates'
PROJECT_DIR_ALT = '/Users/gaurangkumawat/medicanteen/canteen/accounts/templates'

latest_backups = {}

for root, dirs, files in os.walk(HISTORY_DIR):
    if 'entries.json' in files:
        entries_path = os.path.join(root, 'entries.json')
        try:
            with open(entries_path, 'r') as f:
                data = json.load(f)
            
            resource = data.get('resource', '')
            if '/accounts/templates/' in resource and resource.endswith('.html'):
                # Handle possible alternative path the IDE registered
                file_name = resource.split('/accounts/templates/')[-1]
                
                # Find the latest entry
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

print(f"Found {len(latest_backups)} HTML files in vscode history.")
for fname, info in latest_backups.items():
    print(f"Restoring {fname} (timestamp: {info['timestamp']})")
    
    # We must construct the actual project path where we want to place it
    dest_path = os.path.join(PROJECT_DIR, fname)
    
    # Ensure dir exists
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    # Check if backup exists and copy
    if os.path.exists(info['backup_path']):
        shutil.copy2(info['backup_path'], dest_path)
    else:
        print(f"Warning: backup {info['backup_path']} not found!")

print("All found backups restored successfully!")
