import json
from dateutil import parser
import pandas as pd
import pymongo


def load_json(json_file_path):
    with open(json_file_path, 'r') as file:
        data_dict = json.load(file)
    return data_dict
    
    
    
def parse_dob(dob_str):
    try:
        dob_datetime = parser.parse(dob_str)
        return dob_datetime.strftime("%Y-%m-%d")
    except :
        return ""

def read_the_df(file_path,delimeter=","):
    df = pd.read_csv(file_path,delimiter=delimeter)
    return df 

def map_to_our_file_cols(df,mapping_json):
    new_df = pd.DataFrame()
    for key in mapping_json:
        if mapping_json[key]:
            new_df[key] = df[mapping_json[key]]
        else:
            new_df[key]= ""
    new_df['Member DOB'] = new_df['Member DOB'].astype(str).apply(parse_dob)
    return new_df
    
    
    
def rename_fields(df):
    """
    This mapping is for us to save the data in our database
    """
    mapping ={
    "Member First Name": "firstName",
    "Member Last Name": "lastName",
    "Member ID": "patientMemberID",
    "Primary Member ID": "primaryMemberID",
    "Relationship Code": "relationshipCode",
    "Group Name": "groupName",
    "Group Code": "groupNumber",
    "Plan Code": "planNumber",
    "Copay Amount": "copayAmount",
    "Member DOB": "dateOfBirth",
    "Member Gender": "gender",
    "Street": "addressLine1",
    "Street 2": "addressLine2",
    "City": "city",
    "State": "state",
    "Zip": "zip",
    "Phone Number": "phoneNumber",
    "Email Address": "emailAddress",
    "Effective Date": "effectiveDate",
    "Termination Date": "terminationDate",
    "Client Code": "clientCode",
    "Program Name": "programName"}
    df.rename(columns = mapping,inplace=True)
    return df


def get_tenant_db(db_uri,tenant_origin):
    try:
        client = pymongo.MongoClient(db_uri)
        pilote_db = client.UpswingHealth 
        pilote_collection = pilote_db["--pilote--"]
        tenant_data = pilote_collection.find_one({"tenantId": tenant_origin})
        client.close()
        return tenant_data
    except:
        return False
        
        
def insert_records_to_tenant(db_uri,tenant_database_name,member_records):
    try:
        tenant_database_name = "uh_"+tenant_database_name
        print(tenant_database_name)

        client = pymongo.MongoClient(db_uri)
        db = client[tenant_database_name]
        collection = db.eligible_members
        collection.insert_many(member_records)

        return True

    except Exception as e:
        print(e)
        return False