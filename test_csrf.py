import requests

url_base = 'http://127.0.0.1:8000'
s = requests.Session()

# 1. Get CSRF token
res = s.get(f"{url_base}/app/csrf/", headers={"Origin": "https://medi-bite-hub.vercel.app"})
print("GET /app/csrf/ status:", res.status_code)
csrf_token = res.json().get('csrfToken')
print("Token:", csrf_token)
print("Cookies:", s.cookies.get_dict())

# 2. POST to login
res2 = s.post(f"{url_base}/", data={'username': 'test', 'password': '123'}, headers={
    'Origin': 'https://medi-bite-hub.vercel.app',
    'Referer': 'https://medi-bite-hub.vercel.app/',
    'X-CSRFToken': csrf_token
})
print("POST / status:", res2.status_code)
print("Content:", res2.text[:200])
