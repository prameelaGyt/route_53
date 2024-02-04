import pandas as pd

file_extensions = ['csv', 'xlsx', 'txt', 'json'] 

# Function to read files and store in DataFrame
def read_files(file_extensions):
    dataframes = {}  

    for extension in file_extensions:
        file_name = r"C:\Users\PrameelaSathivada\Desktop\UpswingHealth.exercises.csv"
        try:
            if extension == 'csv':
                dataframes[extension] = pd.read_csv(file_name)
            elif extension == 'xlsx':
                dataframes[extension] = pd.read_excel(file_name)
            elif extension == 'txt':
                dataframes[extension] = pd.read_csv(file_name, sep=' ')
            elif extension == 'json':
                dataframes[extension] = pd.read_json(file_name)
            else:
                print(f"Unsupported file extension: {extension}")
        except Exception as e:
            print(f"Error reading {extension} file: {e}")

    return dataframes

resulting_dataframes = read_files(file_extensions)


for extension, df in resulting_dataframes.items():
    print(f"DataFrame from {extension} file:")
    print(df)  
