file_path = 'frontend/src/app/login/page.tsx'
with open(file_path, 'r') as f:
    content = f.read()

content = content.replace(
    '`${process.env.NEXT_PUBLIC_API_URL}/app/password-reset/`',
    '`${process.env.NEXT_PUBLIC_API_URL}/password-reset/`'
)

with open(file_path, 'w') as f:
    f.write(content)

print("Reverted login page URL")
