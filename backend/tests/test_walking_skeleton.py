import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir.parent))

from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] == "2.5.2"
    assert data["docs"] == "/docs"
    assert data["health"] == "/api/health"
    print("test_root_endpoint: PASS")


def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["service"] == "TalentOps AI Backend"
    # Environment is deployment-configured (APP_ENV), not hardcoded to development
    assert data["environment"] in ("development", "staging", "production")
    assert "state_backend" in data
    assert "multi_worker_safe" in data
    print(f"test_health_endpoint: PASS (status={data['status']}, db={data['database']})")


if __name__ == "__main__":
    test_root_endpoint()
    test_health_endpoint()
    print("ALL TESTS PASSED")
