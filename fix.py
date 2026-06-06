import os
import re

src = r"c:\Users\jaek0\Medical App\frontend\src"
for r, d, files in os.walk(src):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            path = os.path.join(r, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            # replace `import { TypeA, TypeB } from './types'` with `import type { ... }`
            new_content = re.sub(r'import\s+\{([^}]+)\}\s+from\s+[\'\"](\.?\./types)[\'\"]', r"import type { \1 } from '\2'", content)
            
            # Remove unused lucide-react icons
            unused = ["Search", "MessageSquare", "Pill", "Calendar", "FileText", "Activity", "ShieldAlert", "GitCommit"]
            for icon in unused:
                new_content = re.sub(rf',\s*{icon}\b', '', new_content)
                new_content = re.sub(rf'\b{icon}\s*,', '', new_content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as file:
                    file.write(new_content)
