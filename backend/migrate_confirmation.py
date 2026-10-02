from core.database import engine
from sqlalchemy import text, inspect

insp = inspect(engine)
cols = [c['name'] for c in insp.get_columns('confirmation_runs')]
print('Current columns:', cols)

if 'data_source' not in cols:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE confirmation_runs ADD COLUMN data_source VARCHAR NOT NULL DEFAULT 'SIMULATED'"))
        conn.commit()
    print('Added data_source column with default SIMULATED')
else:
    print('Column already exists')

# Verify migration
insp2 = inspect(engine)
cols2 = [c['name'] for c in insp2.get_columns('confirmation_runs')]
print('Updated columns:', cols2)

# Check existing records
from core.database import SessionLocal
from optimization.models import ConfirmationRun
db = SessionLocal()
recs = db.query(ConfirmationRun).all()
for r in recs:
    print(f"CR-{r.id}: data_source={r.data_source}")
db.close()
