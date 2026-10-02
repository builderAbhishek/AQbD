import pytest
from fastapi.testclient import TestClient
from main import app
from core.database import Base, engine, get_db
from sqlalchemy.orm import sessionmaker

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    # We won't drop all to avoid affecting other tests running concurrently/sequentially in the same db file if they share it,
    # but normally we'd drop. For now just clear the tables we touch or rely on the transaction.

def test_delete_project_success():
    # Create project
    response = client.post("/api/v1/projects/", json={
        "project_code": "DEL-1",
        "project_name": "Delete Test"
    })
    assert response.status_code == 201
    project_id = response.json()["id"]

    # Delete project
    del_response = client.delete(f"/api/v1/projects/{project_id}")
    assert del_response.status_code == 204

    # Verify not found
    get_response = client.get(f"/api/v1/projects/{project_id}")
    assert get_response.status_code == 404

def test_delete_project_not_found():
    response = client.delete("/api/v1/projects/999999")
    assert response.status_code == 404

def test_delete_report_not_found():
    response = client.delete("/api/v1/reports/999999")
    assert response.status_code == 404

