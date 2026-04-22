import requests
import os

def send_brevo_email(to_email, subject, html_content):
    url = "https://api.brevo.com/v3/smtp/email"

    headers = {
        "accept": "application/json",
        "api-key": os.getenv("BREVO_API_KEY"),
        "content-type": "application/json"
    }

    data = {
        "sender": {
            "name": os.getenv("BREVO_SENDER_NAME", "gk production"),
            "email": os.getenv("BREVO_SENDER_EMAIL")
        },
        "to": [{"email": to_email}],
        "subject": subject,
        "htmlContent": html_content
    }

    response = requests.post(url, json=data, headers=headers)
    return response.status_code, response.text