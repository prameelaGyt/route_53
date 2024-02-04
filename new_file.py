import tabula
import pandas as pd
df = tabula.read_pdf('C:\Users\PrameelaSathivada\Desktop\Popuppage.aspx.pdf', pages = 'all')
#df.head()
#df.to_excel('C:\Users\PrameelaSathivada\Desktop\Popuppage.xlsx')
for i in range(len(df)):
 df[i].to_excel('file_'+str(i)+'.xlsx')
