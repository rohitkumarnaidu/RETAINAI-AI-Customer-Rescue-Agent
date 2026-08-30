from fastapi.testclient import TestClient
from retainai.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "RETAINAI API"


def test_api_status():
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    assert response.json()["status"] == "operational"
