import re

with open('src/lib/statistics/rsm/statistics.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "const modelsToCompare: ModelType[] = ['Linear', '2FI', 'Quadratic'];",
    "const modelsToCompare: ModelType[] = ['Mean', 'Linear', '2FI', 'Quadratic', 'Cubic'] as any[];"
)

with open('src/lib/statistics/rsm/statistics.ts', 'w', encoding='utf-8') as f:
    f.write(content)
