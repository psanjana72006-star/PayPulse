"""Sends the sign-in code by SMS. Choose the provider with SMS_PROVIDER=console|twilio."""
import os, base64, urllib.request, urllib.parse

def send_sms(to: str, text: str):
    provider = os.getenv("SMS_PROVIDER", "console")
    if provider == "console":
        print(f"[SMS to {to}] {text}"); return
    if provider == "twilio":  # works worldwide; phone numbers must be in +countrycode format
        sid, token = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
        data = {"To": to, "Body": text}
        if os.getenv("TWILIO_MESSAGING_SERVICE_SID"): data["MessagingServiceSid"] = os.environ["TWILIO_MESSAGING_SERVICE_SID"]
        else: data["From"] = os.environ["TWILIO_FROM"]
        req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", urllib.parse.urlencode(data).encode(),
            headers={"Authorization": "Basic " + base64.b64encode(f"{sid}:{token}".encode()).decode()})
        urllib.request.urlopen(req, timeout=15).read(); return
    raise RuntimeError(f"Unknown SMS_PROVIDER '{provider}'")  # add MSG91 / Fast2SMS / others here the same way
