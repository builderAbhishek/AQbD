import re

with open('src/lib/statistics/rsm/rsm_v15_scientific_correctness.test.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("expect(res.modelComparison!.length).toBe(3);", "expect(res.modelComparison!.length).toBe(5);")
content = content.replace("const [linearRow, twoFiRow, quadRow] = res.modelComparison!;", "const [meanRow, linearRow, twoFiRow, quadRow, cubicRow] = res.modelComparison!;")

with open('src/lib/statistics/rsm/rsm_v15_scientific_correctness.test.ts', 'w', encoding='utf-8') as f:
    f.write(content)
