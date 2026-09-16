import sys
import os

# Add the ml directory to the python path so imports work correctly
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from ml.api.main import app

client = TestClient(app)

import time

def run_tests():
    print("Running RAG API Tests...")

    # 1. Wait for model to load
    print("Waiting for model to load...")
    max_retries = 30
    for i in range(max_retries):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        if data.get("ragLoaded"):
            print("Model loaded successfully.")
            break
        time.sleep(1)
    else:
        assert False, "RAG model failed to load in time"

    headers = {"Authorization": "Bearer dev-internal-token-change-me"}

    # 2. Empty user index retrieve -> should be 404 index_missing
    response = client.post("/retrieve", json={
        "userId": "user_empty",
        "queryText": "test",
        "topK": 5
    }, headers=headers)
    assert response.status_code == 404
    assert response.json()["detail"] == "index_missing"
    print("Missing user index 404 passed.")

    # 3. User isolation test
    user_A = "user_A"
    user_B = "user_B"

    # Add legitimate email A for User A
    res_A = client.post("/embed", json={
        "userId": user_A,
        "emailId": "email_A_1",
        "text": "Hello User A, here is your legitimate bank statement."
    }, headers=headers)
    assert res_A.status_code == 200

    # Add legitimate email B for User B
    res_B = client.post("/embed", json={
        "userId": user_B,
        "emailId": "email_B_1",
        "text": "Hello User B, here is your legitimate electricity bill."
    }, headers=headers)
    assert res_B.status_code == 200

    # Search as User A
    res_search_A = client.post("/retrieve", json={
        "userId": user_A,
        "queryText": "bank statement",
        "topK": 5
    }, headers=headers)
    results_A = res_search_A.json()["results"]
    assert len(results_A) == 1
    assert results_A[0]["emailId"] == "email_A_1"
    print("User A isolated retrieval passed.")

    # Search as User A with NO MATCHING RESULTS
    res_search_empty = client.post("/retrieve", json={
        "userId": user_A,
        "queryText": "something completely unrelated",
        "topK": 5
    }, headers=headers)
    assert res_search_empty.status_code == 200
    # The faiss index will always return the top K, but if we wanted to threshold it, 
    # we would check the similarities. For now, it returns top K. Wait! Let's just do a basic check.
    
    # Search as User B
    res_search_B = client.post("/retrieve", json={
        "userId": user_B,
        "queryText": "bank statement", 
        "topK": 5
    }, headers=headers)
    results_B = res_search_B.json()["results"]
    assert len(results_B) == 1
    assert results_B[0]["emailId"] == "email_B_1"
    print("User B isolated retrieval passed.")

    # Multiple emails for one user
    client.post("/embed", json={
        "userId": user_A,
        "emailId": "email_A_2",
        "text": "Your account balance for this month is updated."
    }, headers=headers)
    client.post("/embed", json={
        "userId": user_A,
        "emailId": "email_A_3",
        "text": "Password reset successful."
    }, headers=headers)

    res_search_A2 = client.post("/retrieve", json={
        "userId": user_A,
        "queryText": "Did my account balance update?",
        "topK": 5
    }, headers=headers)
    results_A2 = res_search_A2.json()["results"]
    assert len(results_A2) == 3
    assert results_A2[0]["emailId"] == "email_A_2"
    print(f"Multiple emails retrieval passed. Top match similarity: {results_A2[0]['similarity']:.4f}")

    # RAG Context test
    res_context = client.post("/rag-context", json={
        "currentEmail": "Please verify your account immediately or it will be suspended.",
        "historicalEmails": [
            "Your account balance for this month is updated.",
            "Hello User A, here is your legitimate bank statement."
        ]
    }, headers=headers)
    assert res_context.status_code == 200
    context_text = res_context.json()["context"]
    assert "USER'S HISTORICAL LEGITIMATE EMAILS" in context_text
    assert "CURRENT EMAIL TO ANALYZE" in context_text
    assert "Please verify your account immediately" in context_text
    print("RAG Context formatting passed.")

    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
