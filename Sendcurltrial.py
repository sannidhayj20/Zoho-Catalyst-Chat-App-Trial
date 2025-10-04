import requests
import json
url = "https://app-60047381633.development.catalystserverless.in/server/app_function/execute"
chat_id = "22259000000021196"
content = "Hi i am from the bot reply from the python script"
payload = {
    "mode": "send_message",
    "chat_id": chat_id,
    "content": content,
    "is_bot": True
}
headers = {"Content-Type": "application/json"}
response = requests.post(url, headers=headers, data=json.dumps(payload))
print("Status Code:", response.status_code)
print("Response:", response.text)
