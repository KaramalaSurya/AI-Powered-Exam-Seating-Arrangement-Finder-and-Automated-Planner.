# test_auth.py
import urllib.request
import urllib.error
import json
import sys

def run_auth_tests():
    print("----- RUNNING BACKEND AUTHENTICATION TESTS -----")
    base_url = "http://localhost:8085"
    
    # 1. Test unauthorized request
    print("Test 1: Request without authorization header...")
    req = urllib.request.Request(f"{base_url}/api/admin/dashboard-stats")
    try:
        urllib.request.urlopen(req)
        print("[Fail] Request succeeded without auth header")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        assert e.code == 401, f"Expected 401, got {e.code}"
        print(f"[Pass] Got expected status {e.code}")

    # 2. Test invalid authorization header format
    print("Test 2: Request with invalid auth format...")
    req = urllib.request.Request(f"{base_url}/api/admin/dashboard-stats")
    req.add_header("Authorization", "InvalidHeaderFormat")
    try:
        urllib.request.urlopen(req)
        print("[Fail] Request succeeded with invalid header format")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        assert e.code == 401, f"Expected 401, got {e.code}"
        print(f"[Pass] Got expected status {e.code}")

    # 3. Test incorrect token value
    print("Test 3: Request with incorrect token...")
    req = urllib.request.Request(f"{base_url}/api/admin/dashboard-stats")
    req.add_header("Authorization", "Bearer token-wrongpassword")
    try:
        urllib.request.urlopen(req)
        print("[Fail] Request succeeded with incorrect token")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        assert e.code == 401, f"Expected 401, got {e.code}"
        print(f"[Pass] Got expected status {e.code}")

    # 4. Test login with correct password
    print("Test 4: Performing login with correct credentials...")
    login_data = json.dumps({"username": "admin", "password": "admin123"}).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/admin/login",
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode())
            assert res_data["success"] is True
            token = res_data["token"]
            print(f"[Pass] Login successful. Retrieved token: {token}")
    except Exception as e:
        print(f"[Fail] Login failed: {e}")
        sys.exit(1)

    # 5. Test request with correct token
    print("Test 5: Request with correct token...")
    req = urllib.request.Request(f"{base_url}/api/admin/dashboard-stats")
    req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as response:
            assert response.status == 200
            print(f"[Pass] Request succeeded with 200 OK")
    except Exception as e:
        print(f"[Fail] Request with valid token failed: {e}")
        sys.exit(1)

    print("------------------------------------------------------")
    print("ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_auth_tests()
