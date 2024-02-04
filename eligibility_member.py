# from pymongo import MongoClient

# # Function to connect to MongoDB
# def connect_to_mongodb():
#     client = MongoClient('mongodb://localhost:27017')
#     return client

# # Function to retrieve the database name based on tenantId
# def get_db_for_tenant(tenant_id):
#     mongo_client = connect_to_mongodb()
#     pilote_db = mongo_client.UpswingHealth 
#     pilote_collection = pilote_db["--pilote--"]
#     tenant_data = pilote_collection.find_one({"tenantId": tenant_id})
#     if tenant_data:
#         return tenant_data['database']
#     else:
#         return None

# # Function to insert document into the eligibility member collection
# def insert_into_eligibility_member(document, tenant_id):
#     mongo_client = connect_to_mongodb()
#     tenant_db_name = get_db_for_tenant(tenant_id)
#     if tenant_db_name:
#         tenant_db = mongo_client[tenant_db_name]
#         eligibility_member_collection = tenant_db.eligibility_member  

#         # Insert document into the collection
#         eligibility_member_collection.insert_one(document)
#         print("Document inserted successfully into the Eligibility Member collection.")
#     else:
#         print("Tenant ID not found.")

# # Example document
# input_document = {"hii": "there"}
# input_tenant_id = "gytworkz.upswinghealth.co"

# # Call the function to insert the document into the Eligibility Member collection
# insert_into_eligibility_member(input_document, input_tenant_id)


from pymongo import MongoClient
def connect_to_mongodb():
    client = MongoClient('mongodb://localhost:27017')
    return client

# Function to retrieve the database name based on tenantId
def get_db_for_tenant(tenant_id):
    mongo_client = connect_to_mongodb()
    pilote_db = mongo_client.UpswingHealth 
    pilote_collection = pilote_db["--pilote--"]
    tenant_data = pilote_collection.find_one({"tenantId": tenant_id})
    if tenant_data:
        tenant_db_name = tenant_data['database']
        uh_prefixed_db_name = f"uh_{tenant_db_name}" 
        if uh_prefixed_db_name == 'uh_newdb' or uh_prefixed_db_name in mongo_client.list_database_names():
            return uh_prefixed_db_name
        else:
            return None
    else:
        return None

# Function to insert document into the eligibility member collection
def insert_into_eligibility_member(document, tenant_id):
    mongo_client = connect_to_mongodb()
    tenant_db_name = get_db_for_tenant(tenant_id)
    if tenant_db_name:
        tenant_db = mongo_client[tenant_db_name]
        eligibility_member_collection = tenant_db.eligibility_member  
        eligibility_member_collection.insert_one(document)
        print("Document inserted successfully into the Eligibility Member collection.")
    else:
        print("Tenant ID not found or database not existing.")


input_document = {"hii": "hello"}
input_tenant_id = "gytworkz.upswinghealth.co"
insert_into_eligibility_member(input_document, input_tenant_id)
