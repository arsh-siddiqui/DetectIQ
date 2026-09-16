"""
test_classifier.py — ML classifier test cases.

Runs 6 test scenarios and records actual label + probability from the trained model.
Does NOT assert specific label values — records what the model actually predicts.

Usage:
    python ml/tests/test_classifier.py
"""

import sys
import os
import json

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from ml.api.predictor import get_predictor, is_model_loaded


TEST_CASES = [
    {
        "id": "TC1",
        "description": "Legitimate business email",
        "text": (
            "Dear Team, please find attached the Q3 financial report. "
            "The board meeting is scheduled for next Thursday at 10 AM. "
            "Kindly review the documents before the meeting. Best regards, John."
        ),
        "expected_tendency": "safe",
    },
    {
        "id": "TC2",
        "description": "Phishing email (credential theft)",
        "text": (
            "URGENT: Your account has been compromised. Click here immediately to verify your "
            "credentials: http://secure-bank-verify.xyz/login. Enter your username, password, "
            "and card number to restore access. Failure to act within 24 hours will result in "
            "permanent account suspension."
        ),
        "expected_tendency": "phishing",
    },
    {
        "id": "TC3",
        "description": "Urgent bank message",
        "text": (
            "Your bank account will be blocked within 2 hours. Please verify your KYC "
            "immediately by clicking the link below and entering your account details. "
            "This is a final notice from Bank Security."
        ),
        "expected_tendency": "phishing",
    },
    {
        "id": "TC4",
        "description": "OTP request scam",
        "text": (
            "Hi, I am calling from your bank. We detected a suspicious transaction. "
            "To cancel the transaction immediately, please share the OTP you just received "
            "on your registered mobile number. Do not share this with anyone else."
        ),
        "expected_tendency": "phishing",
    },
    {
        "id": "TC5",
        "description": "Job scam",
        "text": (
            "Congratulations! You have been selected for a work-from-home position. "
            "Earn Rs. 50,000 per month by completing simple YouTube liking tasks. "
            "Pay a Rs. 999 registration fee to activate your account. "
            "Join our Telegram group now!"
        ),
        "expected_tendency": "phishing",
    },
    {
        "id": "TC6",
        "description": "Normal conversation",
        "text": (
            "Hey, are you free this weekend? I was thinking we could go hiking. "
            "Let me know what time works for you. Also, did you see the game last night?"
        ),
        "expected_tendency": "safe",
    },
]


def main():
    print("\n" + "="*60)
    print("  DetectIQ ML Classifier — Test Cases")
    print("="*60)

    if not is_model_loaded():
        print("[ERROR] Model is not loaded. Run: python ml/train.py")
        sys.exit(1)

    predictor = get_predictor()
    print(f"Model: {predictor.metadata.get('modelName')} v{predictor.version}")
    print(f"Trained: {predictor.metadata.get('trainedAt', 'unknown')}")
    print()

    results = []
    for tc in TEST_CASES:
        result = predictor.predict(tc["text"])
        tendency_match = result["label"] == tc["expected_tendency"]

        print(f"[{tc['id']}] {tc['description']}")
        print(f"       Predicted: {result['label'].upper()} (probability: {result['probability']:.4f})")
        print(f"       Expected tendency: {tc['expected_tendency']} | Match: {'YES' if tendency_match else 'NO'}")
        print()

        results.append({
            "id": tc["id"],
            "description": tc["description"],
            "label": result["label"],
            "probability": result["probability"],
            "expectedTendency": tc["expected_tendency"],
            "tendencyMatched": tendency_match,
        })

    # Summary
    matched = sum(1 for r in results if r["tendencyMatched"])
    print(f"Expected tendency matched: {matched}/{len(results)}")
    print("Note: Mismatches are recorded honestly, not treated as test failures.")
    print("      The model may legitimately disagree on borderline cases.")

    # Save results
    os.makedirs(os.path.join(os.path.dirname(__file__), "..", "reports"), exist_ok=True)
    report_path = os.path.join(os.path.dirname(__file__), "..", "reports", "classifier_tests.json")
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {report_path}")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
