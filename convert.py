import json

pain_codes = {
    'Right Hip Pain': 'M25.551',
    'Left Hip Pain': 'M25.552',
    'Right Groin Pain': 'R10.12',
    'Left Groin Pain': 'R10.13',
    'Right Thigh Pain': 'M79.651',
    'Left Thigh Pain': 'M79.652',
    'Right Knee Pain': 'M25.561',
    'Right Leg Pain': 'M79.661',
    'Left Leg Pain': 'M79.662',
    'Right Ankle Pain': 'M25.571',
    'Left Ankle Pain': 'M25.572',
    'Right Foot Pain': 'M79.671',
    'Right Toe Pain': 'M79.672',
    'Left Toe Pain': 'M79.673',
    'Right Finger Pain': 'M79.641',
    'Left Finger Pain': 'M79.642',
    'Neck Pain': 'M54.2',
    'Right Shoulder Pain': 'M25.511',
    'Left Shoulder Pain': 'M25.512',
    'Right Elbow Pain': 'M25.521',
    'Left Elbow Pain': 'M25.522',
    'Right Wrist Pain': 'M25.531',
    'Left Wrist Pain': 'M25.532',
    'Right Hand Pain': 'M79.641',
    'Left Hand Pain': 'M79.642',
    'Back Pain': 'M54.5',
    'Other Joint Pain': 'M25.5',
    'Generalized Weakness': 'R53.1',
    'Other abnormalities of gait and mobility': 'R26.89'
}

# Writing dictionary to a JSON file
with open('pain_codes.json', 'w') as json_file:
    json.dump(pain_codes, json_file, indent=4)
