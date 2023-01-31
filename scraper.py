import requests
import json
import time
import os
import math
import base64
from twilio.rest import Client

POST = "POST"
GET = "GET"
URL = base64.b64decode("aHR0cHM6Ly9pbnZlbnRvcnlzZXJ2aWNlcy5ibXdkZWFsZXJwcm9ncmFtcy5jb20v").decode()

##############################################################################
# Configuration
##############################################################################

config = {
    "updateFrequencyHours": 12,
    "filters": {

    },
    "notification": {
        "enable": True,
        "phone_numbers": [""],
        "twilio_account_sid": "",
        "twilio_auth_token": "",
        "twilio_phone_number": ""
    },
    "debug": False,
    "token": None # Set later
}

##############################################################################
# Twilio
##############################################################################

def send_text_msg(msg):
    # print(msg)
    # return
    if not config["notification"]["enable"]:
        print("Notification not enabled")
        return

    client = Client(config["notification"]["twilio_account_sid"], config["notification"]["twilio_auth_token"])

    for phone_number in config["notification"]["phone_numbers"]:
        message = client.messages \
                        .create(
                             body=msg,
                             from_=config["notification"]["twilio_phone_number"],
                             to=phone_number
                         )
        print(message.sid)

##############################################################################
# Send Requests
##############################################################################

def send_request(url, request_type, payload=None, headers=None, cookies=None):
    if config["debug"]:
        print("Request payload: \n%s\n" % payload)
        print("Request Headers: \n%s\n" % headers)
    try:
        response = requests.request(request_type, url, data=payload, headers=headers, cookies=cookies, timeout=10)
    except Exception:
        print("Connection exception")
        return None

    if response.ok:
        if config["debug"]:
            print("Response text: \n%s\n" % response.text)
        return response
    else:
        print("Bad response: %s" % response)

    return None

##############################################################################
# API Endpoints
##############################################################################

def get_token():
    username = base64.b64decode("Qk1XSW52ZW50b3J5QGNyaXRpY2FsbWFzcy5jb20=")
    password = base64.b64decode("MW52M250MHJ5ITIwMjA=")
    host = base64.b64decode("aW52ZW50b3J5c2VydmljZXMuYm13ZGVhbGVycHJvZ3JhbXMuY29t")
    payload = {
        "grant_type": "password",
        "username": username,
        "password": password
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
        # "Host": host
    }
    url = URL + "token"
    response = send_request(url=url, request_type=POST, payload=payload, headers=headers)
    if response:
        return response.json()["access_token"]
    return None

def get_inventory(page):
    # Use radius 0 for nationwide
    auth = "Bearer " + config["token"]
    payload = '{"pageIndex":%d,"PageSize":100,"postalCode":"55115","radius":0,"sortBy":"price","sortDirection":"asc","formatResponse":false,"includeFacets":true,"includeDealers":true,"includeVehicles":true,"filters":[{"name":"Series","values":["3 Series"]},{"name":"Year","values":["2019","2020","2021","2022"]},{"name":"Option","values":[]},{name: "Model", values: ["330i xDrive"]}]}' % page
    headers = {"Content-Type": "application/json", "Accept": "application/json", "Authorization": auth}
    url = URL + "vehicle"
    return send_request(url, request_type=POST, payload=payload, headers=headers)


##############################################################################
# Process Info
##############################################################################

token = get_token()
config["token"] = token

all_unqiue_vins = []

# with open("/tmp/file.txt", "r") as file:
#     if len(content) > 0:
#         content = file.read()
#         content = content.strip("[]")
#         content = content.replace("'", "")
#         vins = content.split(", ")
#         all_unqiue_vins = vins

number = 1

while True:
    all_records = []
    page_index = 0
    results_index = 0
    number_of_pages = 1
    page_size = 100
    while results_index < number_of_pages * page_size:
        print("Fetching %d records for page %d" % (page_size, page_index + 1))
        inventory_results = get_inventory(results_index)

        if inventory_results and inventory_results.json():
            inventory_json = inventory_results.json()
            vehicles = inventory_json["vehicles"]
            all_records += vehicles
            total_records = inventory_json["totalRecords"]
            result_records = inventory_json["resultRecords"]
            page_size = inventory_json["pageSize"]
            number_of_pages = math.ceil(total_records / page_size)
            results_index += page_size
            print("Recieved %d records for page %d" % (result_records, page_index + 1))
            page_index += 1
        else:
            print("Inventory is None")
            break

    print("")
    print("All inventory results have been received")
    print("Total records recieved: %d" % len(all_records))
    print("")

    latest_vins = []
    latest_vins_hash = {}
    for vehicle in all_records:
        year = vehicle["year"]
        modelDescription = vehicle["modelDescription"]
        interior = vehicle["interior"]
        exterior = vehicle["exterior"]
        odometer = vehicle["odometer"]
        vdpUrl = vehicle["vdpUrl"]
        internetPrice = vehicle["internetPrice"]
        msrp = vehicle["msrp"]
        packageDescriptions = vehicle["packageDescriptions"]
        vin = vehicle["vin"]
        distance = vehicle["distance"]
        all_codes = vehicle["allCodes"]

        string = ""
        string += "%s %s\n" % (year, modelDescription)
        string += "%s\n" % (packageDescriptions)
        string += "%s | %s\n" % (exterior, interior)
        string += "$%s\n" % (internetPrice)
        string += "Odometer %s miles\n" % (odometer)
        string += "%s" % (vdpUrl)

        if all_codes and "5AU" in all_codes: #  and "610" in all_codes:
            print(vdpUrl)
            print(internetPrice)

        # latest_vins_hash[vin] = string
        # latest_vins.append(vin)
    break

    if len(all_unqiue_vins) > 0:
        new_vins = list(set(latest_vins).difference(all_unqiue_vins))
        print("Number of new vins %d" % len(new_vins))
        print(new_vins)
        for vin in new_vins:
            send_text_msg("\n\nNEW BMW 330i ALERT\n-----------------------\n%s" % latest_vins_hash[vin])
    else:
        print("Total vin list is empty")

    new_unqiue_vins = all_unqiue_vins + latest_vins

    all_unqiue_vins = list(set(new_unqiue_vins))

    with open("/tmp/file.txt", "w") as file:
        file.write(str(all_unqiue_vins))

    time.sleep(60 * 60)
