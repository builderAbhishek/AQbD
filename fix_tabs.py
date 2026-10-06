import sys

with open('frontend/src/components/layout/ProjectTree.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "{ id: 'Design Table', label: 'Design Table' },"
end_marker = "{ id: 'optimization', label: 'Optimization', disabled: true },"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker) + len(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers")
    sys.exit(1)

replacement = """{ id: 'Design Table', label: 'Design Table' },
        { id: 'Analysis', label: 'Analysis', disabled: !anyResponseComplete },
        { id: 'Diagnostics', label: 'Diagnostics', disabled: !anyResponseComplete },
        { id: 'Graphs', label: 'Graphs', disabled: true },
        { id: 'Optimization', label: 'Optimization', disabled: true },"""

new_content = content[:start_idx] + replacement + content[end_idx:]

with open('frontend/src/components/layout/ProjectTree.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Replaced tabs successfully")
