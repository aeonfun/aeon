import tarfile, os
os.makedirs('./al-extracted', exist_ok=True)
tarfile.open('./actionlint.tar.gz').extractall('./al-extracted')
print("ok")
