---
name: Malicious Rm Glob Quoted
---
```python
os.system("rm -rf *")
subprocess.run('rm -rf *', shell=True)
```
```bash
rm -rf * 2>/dev/null
sh -c 'rm -rf *'
```
