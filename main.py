from io import StringIO
import json
import urllib.parse
import boto3
import pandas as pd 
import os
from utils import *
import pymongo
from utils import load_json


print('Loading function')

s3 = boto3.client('s3')
def lambda_handler( ):
    db_uri = "mongodb://localhost:27017"
    client_config = load_json('client_config.json')

    # Get the object from the event and show its content typ
    try: 
        username="recuro"
        active_client = client_config.get(username)
        print(active_client)
        mapping_json = load_json(active_client.get("template_file"))
        extension = active_client.get("file_extension")
        if extension == ".csv":
            df = pd.read_csv("Recuro.txt", delimiter=active_client.get("separator"))
            template_fields_df = map_to_our_file_cols(df,mapping_json)
            our_db_df= rename_fields(template_fields_df)
            json_data = our_db_df.to_json(orient='records')
            ## Dumping the users data to db 
            tenant_origin = active_client.get("tenant_origin")
            tenant_db_details = get_tenant_db(db_uri,tenant_origin)
            tenant_db_name = tenant_db_details.get("database")
            insert_flag = insert_records_to_tenant(db_uri,tenant_db_name,json.loads(json_data))
            if insert_flag:
                return "Inserted"
            return "Failed to insert"
    
    except Exception as e:
        print(e)
        #print('Error getting object {} from bucket {}. Make sure they exist and your bucket is in the same region as this function.'.format(key, bucket))
        raise e
              

lambda_handler()