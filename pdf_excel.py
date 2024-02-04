import tabula
import pandas as pd

pdf_file = r'C:\Users\PrameelaSathivada\Desktop\Popuppage.aspx.pdf'
excel_file = 'Popuppage_aspx.xlsx'

# Specify the path to the Java executable (java.exe) that you want to use
java_path = r'C:\Program Files\Java\jdk-21\bin\java.exe'

try:
    # Extract tables from the PDF file and specify the Java path
    tables = tabula.read_pdf(pdf_file, pages='all', java_options=f'-Djava.awt.headless=true -Dfile.encoding=UTF8 -Dsun.jnu.encoding=UTF8 -Duser.country=US -Duser.language=en -Duser.variant -Duser.timezone=GMT -Duser.country.format=US -Duser.country.iso=US -Duser.language.format=en -Duser.language.iso=en', java_options=[f"-Djava.library.path={java_path}"])

    # Initialize an empty DataFrame to store the combined tables
    combined_df = pd.DataFrame()

    # Combine all extracted tables into one DataFrame
    for table in tables:
        combined_df = combined_df.append(table, ignore_index=True)

    # Save the combined table into an Excel file
    combined_df.to_excel(excel_file, index=False)

    print(f'Tables extracted and saved to {excel_file}')
except Exception as e:
    print(f'An error occurred: {str(e)}')

