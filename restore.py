import os

missing={'src/components/Assistant.tsx':['FileText'],'src/components/Overview.tsx':['Calendar','Pill','Activity','FileText'],'src/components/ScanViewer.tsx':['ShieldAlert'],'src/components/Sidebar.tsx':['Activity','GitCommit','Calendar','Pill','FileText','ShieldAlert'],'src/components/Symptoms.tsx':['Calendar'],'src/components/Timeline.tsx':['ShieldAlert','FileText','Pill']}

for path, icons in missing.items():
    full_path = os.path.join(r"c:\Users\jaek0\Medical App\frontend", path.replace('/', '\\'))
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    content = f"import {{ {', '.join(icons)} }} from 'lucide-react';\n" + content
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)
